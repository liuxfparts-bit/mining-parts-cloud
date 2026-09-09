echo "=== Container status ==="
docker compose ps
echo "=== App logs ==="
docker compose logs app --tail=30
