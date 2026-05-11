# MB Bank API Production Deploy

CI/CD runs automatically when code is pushed to the `main` branch.

## GitHub Secrets

Create these secrets in GitHub repository settings:

- `PROD_HOST`: production server IP/domain.
- `PROD_USER`: SSH username on the production server.
- `PROD_SSH_KEY`: private SSH key that can access the production server.
- `PROD_SSH_PORT`: SSH port. Use `22` if unsure.
- `DOCKERHUB_USERNAME`: Docker Hub username, for example `taikhoanxin`.
- `DOCKERHUB_TOKEN`: Docker Hub access token.

MB Bank credentials are read from the existing production env file:

```text
/opt/TaiKhoanXin/Production/env/mbbankapi.env
```

## Production Server Requirements

Install Docker and Docker Compose plugin on the server.

```bash
docker --version
docker compose version
```

Open port `5001` on the server firewall/security group.

Create the production env file on the server:

```bash
cd /opt/TaiKhoanXin/Production/env
rm -rf mbbankapi.env
nano mbbankapi.env
```

Example content:

```env
PORT=5001
MB_USERNAME=your_mb_username
MB_PASSWORD=your_mb_password
MB_BANK_CARD_DEFAULT=your_default_account_number
MB_TRANSACTION_DAYS=7
```

## Deploy

Push to `main`:

```bash
git add .
git commit -m "chore: add Docker production CI/CD"
git push origin main
```

GitHub Actions will:

1. Build the Docker image.
2. Push it to Docker Hub as `taikhoanxin/tkx-mb-bank-api`.
3. SSH into the production server.
4. Use `/opt/TaiKhoanXin/Production/env/mbbankapi.env`.
5. Pull and restart the `mb-bank-api` container.

## Verify

On the production server:

```bash
cd /opt/mb-bank-api
docker compose -f docker-compose.prod.yml ps
docker logs -f mb-bank-api
curl http://localhost:5001/health
curl "http://localhost:5001/transactions/MB"
```

Public endpoint:

```text
http://YOUR_SERVER_IP:5001/transactions/MB
```
