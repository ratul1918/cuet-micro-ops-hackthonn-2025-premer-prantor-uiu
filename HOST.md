# Hosting Guide for Delineate

This guide will help you host the Delineate application on a Virtual Private Server (VPS) and access it from any PC.

## 1. Prerequisites

### Hardware Requirements (VPS)
Since this application includes a full observability stack (Prometheus, Grafana, Loki, Jaeger) alongside MinIO and Redis, you will need a VPS with sufficient resources:
- **OS**: Ubuntu 22.04 LTS (Recommended)
- **CPU**: 2 vCPUs
- **RAM**: 4GB minimum (8GB recommended for stable performance)
- **Storage**: 20GB+ SSD

### Software
- **Docker**: Container runtime
- **Git**: Version control

## 2. Server Setup (Step-by-Step)

SSH into your VPS:
```bash
ssh root@<your-vps-ip>
```

### Step 1: Install Docker
Run the following commands to install Docker and Docker Compose plugin:

```bash
# Update package list
sudo apt update
sudo apt upgrade -y

# Install prerequisites
sudo apt install -y ca-certificates curl gnupg

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add the repository to Apt sources
echo \
  "deb [arch=\"$(dpkg --print-architecture)\" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify installation
docker compose version
```

### Step 2: Configure Firewall
Open the necessary ports to access the application and its tools.

```bash
# Allow SSH
sudo ufw allow 22

# Allow Application
sudo ufw allow 3000

# Allow Grafana (Observability Dashboard)
sudo ufw allow 3001

# Allow MinIO (S3 Console)
sudo ufw allow 9001

# Allow Jaeger (Tracing UI)
sudo ufw allow 16686

# Enable Firewall
sudo ufw enable
```

## 3. Deploy the Application

### Step 1: Clone the Repository
Clone your project to the server.

```bash
git clone https://github.com/your-username/cuet-micro-ops-hackthon-2025.git
cd cuet-micro-ops-hackthon-2025
```
*(Replace the URL with your actual Git repository URL)*

### Step 2: Configure Environment
Create the `.env` file from the example.

```bash
cp .env.example .env
```

You usually **don't** need to change the URLs in `.env` because `docker-compose.prod.yml` automatically sets the correct internal service names (like `http://minio:9000`).

However, if you want to change passwords, edit the file:
```bash
nano .env
```
*Press `Ctrl+X`, then `Y`, then `Enter` to save and exit.*

### Step 3: Start the Application
Run the production docker compose file. This command will build the app and start all containers in the background.

```bash
npm run docker:prod
```
*Note: If `npm` is not installed, you can run:*
```bash
docker compose -f docker/compose.prod.yml up --build -d
```

## 4. Accessing the Application

Once the containers are running (check with `docker compose ps`), you can access the services using your VPS Public IP.

| Service | URL | Default Creds (if any) |
|---------|-----|------------------------|
| **Delineate App** | `http://<your-vps-ip>:3000` | N/A |
| **Grafana** | `http://<your-vps-ip>:3001` | user: `admin`, pass: `admin` |
| **MinIO Console**| `http://<your-vps-ip>:9001` | user: `minioadmin`, pass: `minioadmin` |
| **Jaeger UI** | `http://<your-vps-ip>:16686`| N/A |
| **Prometheus** | `http://<your-vps-ip>:9090` | N/A |

### Example
If your VPS IP is `192.168.1.100`, open your browser and go to:
`http://192.168.1.100:3000/health`

## 5. Troubleshooting

- **Check logs**:
  ```bash
  docker compose -f docker/compose.prod.yml logs -f delineate-app
  ```
- **Stop everything**:
  ```bash
  docker compose -f docker/compose.prod.yml down
  ```
- **Restart everything**:
  ```bash
  docker compose -f docker/compose.prod.yml restart
  ```
