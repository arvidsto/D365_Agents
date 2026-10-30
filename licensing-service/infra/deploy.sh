#!/usr/bin/env bash
# Deploys the licensing service to Azure (Southeast Asia) with Azure CLI.
# Review every value before running. Requires: az login, Node 20+, Azure Functions Core Tools.
set -euo pipefail

RG="rg-agent-licensing"
LOCATION="southeastasia"
STORAGE="stagentlic$RANDOM"          # must be globally unique, lowercase
FUNCAPP="func-agent-licensing-$RANDOM"
APIM="apim-agent-licensing-$RANDOM"
PUBLISHER_EMAIL="you@yourcompany.com"
PUBLISHER_NAME="Your Company"
APPINSIGHTS="appi-agent-licensing"

az group create -n "$RG" -l "$LOCATION"

# Storage: function runtime + licence table (no customer data is stored)
az storage account create -n "$STORAGE" -g "$RG" -l "$LOCATION" --sku Standard_LRS \
  --min-tls-version TLS1_2 --allow-blob-public-access false
az storage table create --name Licences --account-name "$STORAGE" --auth-mode login

# Application Insights for the function's own minimal log lines
az monitor app-insights component create -a "$APPINSIGHTS" -g "$RG" -l "$LOCATION"

# Function App on Flex Consumption with a system-assigned identity
az functionapp create -n "$FUNCAPP" -g "$RG" --storage-account "$STORAGE" \
  --flexconsumption-location "$LOCATION" --runtime node --runtime-version 20 \
  --app-insights "$APPINSIGHTS"
PRINCIPAL_ID=$(az functionapp identity assign -n "$FUNCAPP" -g "$RG" --query principalId -o tsv)
STORAGE_ID=$(az storage account show -n "$STORAGE" -g "$RG" --query id -o tsv)
az role assignment create --assignee-object-id "$PRINCIPAL_ID" --assignee-principal-type ServicePrincipal \
  --role "Storage Table Data Reader" --scope "$STORAGE_ID"

az functionapp config appsettings set -n "$FUNCAPP" -g "$RG" --settings \
  LICENCE_STORE=table \
  LICENCE_TABLE_URL="https://$STORAGE.table.core.windows.net" \
  LICENCE_TABLE_NAME=Licences \
  WARNING_DAYS=30 DEFAULT_GRACE_DAYS=7 DEFAULT_OFFLINE_HOURS=4 MAX_OFFLINE_HOURS=24

# Deploy code (run from the licensing-service folder)
npm ci --omit=dev
npm run validate-skills
func azure functionapp publish "$FUNCAPP"

# API Management (Consumption) in front of the function
az apim create -n "$APIM" -g "$RG" -l "$LOCATION" --sku-name Consumption \
  --publisher-email "$PUBLISHER_EMAIL" --publisher-name "$PUBLISHER_NAME"
FUNC_KEY=$(az functionapp keys list -n "$FUNCAPP" -g "$RG" --query functionKeys.default -o tsv)
FUNC_HOST=$(az functionapp show -n "$FUNCAPP" -g "$RG" --query defaultHostName -o tsv)
az apim nv create -g "$RG" --service-name "$APIM" --named-value-id licensing-function-key \
  --display-name licensing-function-key --value "$FUNC_KEY" --secret true
az apim nv create -g "$RG" --service-name "$APIM" --named-value-id licensing-function-host \
  --display-name licensing-function-host --value "$FUNC_HOST"
az apim api import -g "$RG" --service-name "$APIM" --api-id licensing --path licensing \
  --specification-format Swagger --specification-path ../connector/apiDefinition.swagger.json \
  --subscription-required false

echo "Now apply infra/apim-policy.xml to the 'licensing' API (portal: APIs > licensing > All operations > Policy)."
echo "Service base URL: https://$APIM.azure-api.net/licensing"
