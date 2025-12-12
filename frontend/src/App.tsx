import { useState, useEffect, useCallback } from "react";
import * as Sentry from "@sentry/react";
import { trace } from "@opentelemetry/api";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileDown,
  Loader2,
  RefreshCw,
  Server,
  XCircle,
  Zap,
  TrendingUp,
  Database,
  Gauge,
} from "lucide-react";

// API Configuration
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";
const JAEGER_URL = import.meta.env.VITE_JAEGER_URL || "http://localhost:16686";

// Types
interface HealthStatus {
  status: "healthy" | "unhealthy";
  checks: {
    storage: "ok" | "error";
  };
}

interface MetricsData {
  totalRequests: number;
  avgLatency: number;
  errorRate: number;
  requestsPerSecond: number;
}

interface RealtimeLog {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  service: string;
  traceId?: string;
  metadata?: {
    method?: string;
    path?: string;
    status?: number;
    duration?: number;
  };
}

interface ExportJob {
  jobId: string;
  status: string;
  progress: {
    percent: number;
    currentFile: number;
    totalFiles: number;
    stage: string;
    message: string;
  } | null;
  result: {
    s3Key: string;
    downloadUrl: string;
    fileSize: number;
    processedFiles: number;
    totalFiles: number;
  } | null;
  error: string | null;
  createdAt?: string;
}

interface ErrorLog {
  id: string;
  message: string;
  timestamp: string;
  traceId?: string;
}

const tracer = trace.getTracer("delineate-frontend");

function App() {
  // State
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [realtimeLogs, setRealtimeLogs] = useState<RealtimeLog[]>([]);
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [fileIds, setFileIds] = useState("10000, 20000, 30000");

  // Fetch health status
  const fetchHealth = useCallback(async () => {
    const span = tracer.startSpan("fetchHealth");
    setHealthLoading(true);
    try {
      const response = await fetch(`${API_BASE}/health`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setHealth(data);
      span.setStatus({ code: 1 });
    } catch (error) {
      console.error("Health check failed:", error);
      addError("Health check failed: " + (error as Error).message);
      setHealth(null);
      span.setStatus({ code: 2, message: (error as Error).message });
    } finally {
      setHealthLoading(false);
      span.end();
    }
  }, []);

  // Fetch metrics
  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/metrics`);
      if (!response.ok) return;

      const metricsText = await response.text();
      const totalRequests = parseMetric(metricsText, "http_requests_total");
      const latencySum = parseMetric(
        metricsText,
        "http_request_duration_seconds_sum",
      );
      const latencyCount = parseMetric(
        metricsText,
        "http_request_duration_seconds_count",
      );
      const errorRequests = parseMetricWithStatus(metricsText, "5");

      setMetrics({
        totalRequests,
        avgLatency: latencyCount > 0 ? (latencySum / latencyCount) * 1000 : 0,
        errorRate:
          totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0,
        requestsPerSecond: totalRequests / 60, // Rough estimate
      });
    } catch (error) {
      console.error("Metrics fetch failed:", error);
    }
  }, []);

  // Parse Prometheus metrics
  const parseMetric = (text: string, metricName: string): number => {
    const lines = text.split("\n");
    let sum = 0;
    for (const line of lines) {
      if (line.startsWith(metricName) && !line.includes("#")) {
        const match = line.match(/\s+([\d.]+)$/);
        if (match) sum += parseFloat(match[1]);
      }
    }
    return sum;
  };

  const parseMetricWithStatus = (
    text: string,
    statusPrefix: string,
  ): number => {
    const lines = text.split("\n");
    let sum = 0;
    for (const line of lines) {
      if (line.includes(`status="${statusPrefix}`) && !line.includes("#")) {
        const match = line.match(/\s+([\d.]+)$/);
        if (match) sum += parseFloat(match[1]);
      }
    }
    return sum;
  };

  // Fetch real-time logs
  const fetchLogs = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/logs?limit=50`);
      if (!response.ok) return;
      const data = await response.json();
      setRealtimeLogs(data.logs || []);
    } catch (error) {
      console.error("Logs fetch failed:", error);
    }
  }, []);

  // Add error to log
  const addError = (message: string, traceId?: string) => {
    const error: ErrorLog = {
      id: crypto.randomUUID(),
      message,
      timestamp: new Date().toISOString(),
      traceId,
    };
    setErrors((prev) => [error, ...prev].slice(0, 10));
  };

  // Create export job
  const createExportJob = async () => {
    const span = tracer.startSpan("createExportJob");
    setIsCreatingJob(true);

    try {
      const ids = fileIds.split(",").map((id) => parseInt(id.trim(), 10));
      const response = await fetch(`${API_BASE}/v1/export/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_ids: ids, user_id: "dashboard-user" }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const newJob: ExportJob = {
        jobId: data.jobId,
        status: data.status,
        progress: null,
        result: null,
        error: null,
        createdAt: new Date().toISOString(),
      };
      setJobs((prev) => [newJob, ...prev]);
      span.setStatus({ code: 1 });
      pollJobStatus(data.jobId);
    } catch (error) {
      console.error("Create job failed:", error);
      Sentry.captureException(error);
      addError(
        "Create job failed: " + (error as Error).message,
        span.spanContext().traceId,
      );
      span.setStatus({ code: 2, message: (error as Error).message });
    } finally {
      setIsCreatingJob(false);
      span.end();
    }
  };

  // Poll job status
  const pollJobStatus = async (jobId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`${API_BASE}/v1/export/status/${jobId}`);
        if (!response.ok) return;

        const data = await response.json();
        setJobs((prev) =>
          prev.map((job) =>
            job.jobId === jobId
              ? {
                  ...job,
                  status: data.status,
                  progress: data.progress,
                  result: data.result,
                  error: data.error,
                }
              : job,
          ),
        );

        if (data.status !== "completed" && data.status !== "failed") {
          setTimeout(poll, 2000);
        }
      } catch (error) {
        console.error("Poll failed:", error);
      }
    };
    poll();
  };

  // Trigger Sentry test error - REAL ERROR TO CLOUD
  const triggerSentryTest = async () => {
    const span = tracer.startSpan("triggerSentryTest");
    try {
      // 1. Capture a test error to Sentry cloud
      const testError = new Error(
        "🚨 Demo Error: Sentry Integration Test from Observability Dashboard",
      );
      testError.name = "SentryIntegrationTest";

      // Add extra context
      Sentry.setContext("test_context", {
        test_type: "manual_dashboard_test",
        timestamp: new Date().toISOString(),
        environment: import.meta.env.MODE,
      });

      // Capture to Sentry cloud
      const eventId = Sentry.captureException(testError, {
        level: "warning",
        tags: {
          test: "manual",
          source: "dashboard",
        },
      });

      console.log("✅ Sentry test error sent! Event ID:", eventId);

      // 2. Also trigger backend error for trace correlation
      const response = await fetch(
        `${API_BASE}/v1/download/check?sentry_test=true`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_id: 70000 }),
        },
      );

      const data = await response.json();
      addError(
        `✅ Test errors sent to Sentry! Frontend Event ID: ${eventId}`,
        span.spanContext().traceId,
      );

      // Show success message
      alert(
        `✅ Test error sent to Sentry!\n\nEvent ID: ${eventId}\n\nCheck your Sentry dashboard to verify the error was received.`,
      );

      span.setStatus({ code: 1 });
    } catch (error) {
      console.error("Sentry test failed:", error);
      Sentry.captureException(error);
      addError(
        "Sentry test failed: " + (error as Error).message,
        span.spanContext().traceId,
      );
      span.setStatus({ code: 2, message: (error as Error).message });
    } finally {
      span.end();
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchHealth();
    fetchMetrics();
    fetchLogs();
  }, [fetchHealth, fetchMetrics, fetchLogs]);

  // Auto-refresh health every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  // Auto-refresh metrics every 5 seconds
  useEffect(() => {
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  // Auto-refresh logs every 3 seconds
  useEffect(() => {
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case "error":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "warn":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "info":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "debug":
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Zap className="w-8 h-8 text-blue-500" />
                Delineate Observability Dashboard
              </h1>
              <p className="text-slate-400 mt-1">
                Real-time monitoring with Sentry & OpenTelemetry
              </p>
            </div>
            <div className="flex gap-3">
              <a
                href={JAEGER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Jaeger UI
              </a>
              <a
                href={`${API_BASE}/docs`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                API Docs
              </a>
            </div>
          </div>
        </header>

        {/* Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 p-6 rounded-lg border border-blue-500/20 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              <span className="text-xs text-blue-400/70">Total</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {metrics?.totalRequests.toLocaleString() ?? 0}
            </div>
            <div className="text-xs text-slate-400 mt-1">API Requests</div>
          </div>

          <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 p-6 rounded-lg border border-green-500/20 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <Gauge className="w-5 h-5 text-green-400" />
              <span className="text-xs text-green-400/70">Avg</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {metrics?.avgLatency.toFixed(0) ?? 0}ms
            </div>
            <div className="text-xs text-slate-400 mt-1">Latency</div>
          </div>

          <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 p-6 rounded-lg border border-purple-500/20 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <Database className="w-5 h-5 text-purple-400" />
              <span className="text-xs text-purple-400/70">Rate</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {metrics?.requestsPerSecond.toFixed(1) ?? 0}
            </div>
            <div className="text-xs text-slate-400 mt-1">Req/s</div>
          </div>

          <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 p-6 rounded-lg border border-red-500/20 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <span className="text-xs text-red-400/70">Errors</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {metrics?.errorRate.toFixed(1) ?? 0}%
            </div>
            <div className="text-xs text-slate-400 mt-1">Error Rate</div>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Health Status Card */}
          <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Server className="w-5 h-5" />
                API Health
              </h2>
              <button
                onClick={fetchHealth}
                disabled={healthLoading}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <RefreshCw
                  className={`w-4 h-4 ${healthLoading ? "animate-spin" : ""}`}
                />
              </button>
            </div>
            {health ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status</span>
                  <span
                    className={`flex items-center gap-2 font-medium ${
                      health.status === "healthy"
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    {health.status === "healthy" ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    {health.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Storage</span>
                  <span
                    className={`flex items-center gap-2 font-medium ${
                      health.checks?.storage === "ok"
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    {health.checks?.storage === "ok" ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    {health.checks?.storage || "unknown"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-slate-500 flex items-center gap-2 py-4 justify-center">
                {healthLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <span className="text-red-400">Offline</span>
                )}
              </div>
            )}
          </div>

          {/* Create Export Job Card */}
          <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-sm">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <FileDown className="w-5 h-5" />
              Create Export Job
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-slate-400 block mb-1">
                  File IDs (comma-separated)
                </label>
                <input
                  type="text"
                  value={fileIds}
                  onChange={(e) => setFileIds(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="10000, 20000, 30000"
                />
              </div>
              <button
                onClick={createExportJob}
                disabled={isCreatingJob}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingJob ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {isCreatingJob ? "Creating..." : "Create Job"}
              </button>
            </div>
          </div>

          {/* Sentry Test Card */}
          <div className="bg-gradient-to-br from-orange-500/10 to-red-600/5 p-6 rounded-lg border border-orange-500/30 shadow-sm">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-orange-400" />
              Sentry Integration
            </h2>
            <p className="text-slate-400 text-sm mb-4">
              Send a test error to Sentry cloud to verify integration and trace
              correlation.
            </p>
            <button
              onClick={triggerSentryTest}
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-orange-500/50"
            >
              <AlertCircle className="w-4 h-4" />
              Send Test Error to Sentry
            </button>
            <p className="text-xs text-orange-400/70 mt-3 text-center">
              Check Sentry dashboard after clicking
            </p>
          </div>
        </div>

        {/* Real-time Logs Section */}
        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-400" />
              Real-time Logs ({realtimeLogs.length})
            </h2>
            <button
              onClick={fetchLogs}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {realtimeLogs.length > 0 ? (
              realtimeLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-slate-700/50 rounded-lg p-3 border border-slate-600"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium border ${getLogLevelColor(log.level)}`}
                        >
                          {log.level.toUpperCase()}
                        </span>
                        <span className="text-xs text-slate-500">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        {log.metadata?.duration && (
                          <span className="text-xs text-blue-400">
                            {log.metadata.duration}ms
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-300">{log.message}</p>
                      {log.traceId && (
                        <a
                          href={`${JAEGER_URL}/trace/${log.traceId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:underline flex items-center gap-1 mt-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Trace: {log.traceId.slice(0, 8)}...
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-500 text-center py-8">
                No logs available
              </p>
            )}
          </div>
        </div>

        {/* Jobs and Errors Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Jobs Section */}
          <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-sm">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5" />
              Export Jobs ({jobs.length})
            </h2>
            {jobs.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {jobs.map((job) => (
                  <div
                    key={job.jobId}
                    className="bg-slate-700/50 rounded-lg p-4 border border-slate-600"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-sm text-slate-300">
                        {job.jobId.slice(0, 8)}...
                      </span>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          job.status === "completed"
                            ? "bg-green-500/20 text-green-400"
                            : job.status === "failed"
                              ? "bg-red-500/20 text-red-400"
                              : "bg-yellow-500/20 text-yellow-400"
                        }`}
                      >
                        {job.status}
                      </span>
                    </div>
                    {job.progress && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                          <span>{job.progress.message}</span>
                          <span>{job.progress.percent}%</span>
                        </div>
                        <div className="w-full bg-slate-600 rounded-full h-2">
                          <div
                            className="bg-blue-500 rounded-full h-2 transition-all duration-300"
                            style={{ width: `${job.progress.percent}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {job.result && (
                      <div className="mt-2 text-sm text-slate-400 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                        <span>
                          {job.result.processedFiles} files (
                          {Math.round(job.result.fileSize / 1024)} KB)
                        </span>
                        {job.result.downloadUrl && (
                          <a
                            href={job.result.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-auto text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" />
                            Download
                          </a>
                        )}
                      </div>
                    )}
                    {job.error && (
                      <div className="mt-2 text-sm text-red-400 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Error: {job.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-8">
                No jobs yet. Create one above to get started.
              </p>
            )}
          </div>

          {/* Error Log Section */}
          <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-sm">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-red-400" />
              Error Log ({errors.length})
            </h2>
            {errors.length > 0 ? (
              <div className="space-y-2">
                {errors.map((error) => (
                  <div
                    key={error.id}
                    className="bg-red-500/10 border border-red-500/30 rounded-lg p-3"
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-red-400 text-sm font-medium">
                        {error.message}
                      </span>
                      <span className="text-slate-500 text-xs flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(error.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    {error.traceId && (
                      <div className="mt-1">
                        <a
                          href={`${JAEGER_URL}/trace/${error.traceId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Trace: {error.traceId.slice(0, 8)}...
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-4">
                No errors captured.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
