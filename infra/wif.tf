# Workload Identity Federation (WIF) for GitHub Actions OIDC (web repo)
# Creates a dedicated WIF pool/provider restricted to this repository and
# grants impersonation on the deployment service account.

# Project details (project number used in principalSet bindings)
data "google_project" "wif_project" {
  project_id = var.project_id
}

# Dedicated pool for this repo (avoid clashing with backend repo pool)
resource "google_iam_workload_identity_pool" "github_web" {
  project                   = var.project_id
  workload_identity_pool_id = var.wif_pool_id
  display_name              = "GitHub OIDC Pool (web)"
  description               = "Trust GitHub Actions OIDC tokens for this repo"
}

# OIDC provider for GitHub within the above pool, restricted to this repository
resource "google_iam_workload_identity_pool_provider" "github_web" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github_web.workload_identity_pool_id
  workload_identity_pool_provider_id = var.wif_provider_id
  display_name                       = "GitHub (web)"
  description                        = "OIDC provider for GitHub Actions (web repo)"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }

  # Restrict to this repository
  attribute_condition = "assertion.repository == '${var.github_repository}'"
}

# Allow identities from the GitHub OIDC provider (this repository) to impersonate the deploy SA
# Case 1: we create the deploy SA in this repo
resource "google_service_account_iam_member" "deploy_wif_impersonation_created" {
  count              = var.create_deploy_sa ? 1 : 0
  service_account_id = google_service_account.deploy[0].name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/projects/${data.google_project.wif_project.number}/locations/global/workloadIdentityPools/${google_iam_workload_identity_pool.github_web.workload_identity_pool_id}/attribute.repository/${var.github_repository}"
}

# Case 2: deploy SA already exists (create_deploy_sa=false) — bind WIF to provided email
resource "google_service_account_iam_member" "deploy_wif_impersonation_existing" {
  count              = (!var.create_deploy_sa && var.deploy_sa_email != "") ? 1 : 0
  service_account_id = "projects/${var.project_id}/serviceAccounts/${var.deploy_sa_email}"
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/projects/${data.google_project.wif_project.number}/locations/global/workloadIdentityPools/${google_iam_workload_identity_pool.github_web.workload_identity_pool_id}/attribute.repository/${var.github_repository}"
}

# Generate GitHub Actions repository variables file to be applied via workflow
locals {
  default_compute_sa = "${data.google_project.wif_project.number}-compute@developer.gserviceaccount.com"
}

resource "local_file" "actions_variables" {
  filename = "${path.module}/../.github/actions-variables.json"
  content  = jsonencode({
    GCP_WIF_PROVIDER      = google_iam_workload_identity_pool_provider.github_web.name
    GCP_DEPLOY_SA         = var.create_deploy_sa ? google_service_account.deploy[0].email : (var.deploy_sa_email != "" ? var.deploy_sa_email : null)
    GCP_PROJECT_ID        = var.project_id
    GCP_REGION            = var.region
    ARTIFACT_REPO         = var.artifact_repo_id
    IMAGE_NAME            = var.service_name
    SERVICE               = var.service_name
    TF_BUCKET             = var.tfstate_bucket_name
    TF_PREFIX             = var.tfstate_prefix
    CLOUD_RUN_RUNTIME_SA  = local.default_compute_sa
  })
  depends_on = [
    google_iam_workload_identity_pool_provider.github_web,
  ]
}
