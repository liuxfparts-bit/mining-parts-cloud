cd /opt/mining-parts-cloud
docker compose ps
echo "=== APP LOGS ==="
docker compose logs app --tail=50
