.PHONY: aws-up aws-down local-up local-down logs clean

# --- Comandos AWS (Terraform) ---
aws-up:
	@echo "Verificando dependencias..."
	@which psql > /dev/null || (apt-get update -qq && apt-get install -y -qq postgresql-client)
	@echo "Desplegando infraestructura en AWS..."
	mkdir -p edge_gateway/certs
	cd terraform && terraform init && terraform apply -auto-approve
	@echo "Infraestructura base desplegada."
	bash scripts/deploy.sh

aws-down:
	@echo "Destruyendo infraestructura en AWS..."
	cd terraform && terraform destroy -auto-approve
	@echo "Infraestructura de AWS destruida."

# --- Comandos Locales (Docker Compose) ---
local-up:
	@echo "Levantando Edge Gateway y Sensores locales..."
	docker compose up -d --build
	@echo "Contenedores iniciados. Usa 'make logs' para ver el flujo de datos."

local-down:
	@echo "Deteniendo contenedores locales..."
	docker compose down
	@echo "Contenedores detenidos."

logs:
	docker compose logs -f

clean: local-down aws-down
	@echo "Limpiando certificados locales..."
	rm -rf edge_gateway/certs/*
	rm -f edge_gateway/mosquitto.conf
	rm -rf terraform/.terraform terraform/.terraform.lock.hcl terraform/terraform.tfstate terraform/terraform.tfstate.backup
	@echo "Entorno limpio."
