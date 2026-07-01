-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PUBLIC', 'AGENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "KitRequestStatus" AS ENUM ('DRAFT', 'PENDING_GENERATION', 'GENERATING', 'COMPLETED', 'REVIEWED', 'SENT_TO_CUSTOMER', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "WindowType" AS ENUM ('ANTA_RIBALTA', 'ANTA_PROIETTANTE', 'ANTA_BATTENTE', 'SCORREVOLE_ALZANTE', 'SCORREVOLE_TRASLANTE', 'VASISTAS', 'FINESTRA_TETTO');

-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('LEGNO', 'PVC', 'ALLUMINIO', 'LEGNO_ALLUMINIO', 'PVC_ALLUMINIO');

-- CreateEnum
CREATE TYPE "HingeSide" AS ENUM ('DESTRA', 'SINISTRA');

-- CreateEnum
CREATE TYPE "OpeningDirection" AS ENUM ('TIRARE', 'SPINGERE');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM', 'TOOL');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'SENT', 'ERROR', 'STREAMING');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('LOGIN', 'LOGOUT', 'CONVERSATION_CREATED', 'CONVERSATION_MESSAGE', 'KIT_REQUEST_CREATED', 'KIT_GENERATED', 'KIT_EXPORTED_PDF', 'PRODUCT_SEARCHED', 'CUSTOMER_VIEWED', 'SETTINGS_CHANGED', 'USER_CREATED', 'USER_UPDATED', 'IMPORT_EXECUTED');

-- CreateEnum
CREATE TYPE "SettingCategory" AS ENUM ('AI_PROVIDER', 'API_KEYS', 'COMPANY_INFO', 'EMAIL', 'RATE_LIMITS', 'FEATURE_FLAGS');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'AGENT',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "agb_code" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "short_description" TEXT,
    "base_price" DECIMAL(12,2) NOT NULL,
    "discounted_price" DECIMAL(12,2),
    "price_unit" TEXT NOT NULL DEFAULT 'EUR',
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "category_id" TEXT NOT NULL,
    "image_urls" TEXT[],
    "datasheet_url" TEXT,
    "specifications" JSONB,
    "weight_kg" DECIMAL(8,3),
    "length_mm" INTEGER,
    "width_mm" INTEGER,
    "height_mm" INTEGER,
    "search_vector" tsvector,
    "embedding" vector(768),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kit_requests" (
    "id" TEXT NOT NULL,
    "request_number" TEXT NOT NULL,
    "window_type" "WindowType" NOT NULL,
    "width_mm" INTEGER NOT NULL,
    "height_mm" INTEGER NOT NULL,
    "material" "MaterialType" NOT NULL,
    "air_gap_mm" INTEGER NOT NULL,
    "axis_offset_mm" INTEGER NOT NULL,
    "rebate_mm" INTEGER NOT NULL,
    "seat_mm" INTEGER NOT NULL,
    "opening_side" "HingeSide" NOT NULL,
    "opening_direction" "OpeningDirection" NOT NULL,
    "finish" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "notes" TEXT,
    "customer_notes" TEXT,
    "status" "KitRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "generated_kit" JSONB,
    "total_components" INTEGER NOT NULL DEFAULT 0,
    "total_price" DECIMAL(12,2),
    "agent_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "pdf_url" TEXT,
    "pdf_generated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "generated_at" TIMESTAMP(3),

    CONSTRAINT "kit_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kit_components" (
    "id" TEXT NOT NULL,
    "kit_request_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "component_code" TEXT NOT NULL,
    "component_name" TEXT NOT NULL,
    "position" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "total_price" DECIMAL(12,2) NOT NULL,
    "rule_id" TEXT,
    "rule_description" TEXT,
    "is_optional" BOOLEAN NOT NULL DEFAULT false,
    "is_alternative" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kit_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kit_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "window_type" "WindowType",
    "material" "MaterialType",
    "series" TEXT,
    "rules" JSONB NOT NULL,
    "category_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kit_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "vat_number" TEXT,
    "tax_code" TEXT,
    "contact_name" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "province" TEXT,
    "zip_code" TEXT,
    "country" TEXT NOT NULL DEFAULT 'IT',
    "customer_code" TEXT,
    "price_list" TEXT,
    "payment_terms" TEXT,
    "discount" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Nuova Conversazione',
    "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "context_json" JSONB,
    "agent_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "content_html" TEXT,
    "tool_name" TEXT,
    "tool_input" JSONB,
    "tool_output" JSONB,
    "model_used" TEXT,
    "tokens_used" INTEGER,
    "latency_ms" INTEGER,
    "referenced_product_ids" TEXT[],
    "status" "MessageStatus" NOT NULL DEFAULT 'SENT',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "type" "ActivityType" NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "ip_hash" TEXT,
    "user_agent" TEXT,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "category" "SettingCategory" NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "is_encrypted" BOOLEAN NOT NULL DEFAULT false,
    "updated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "sync_type" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "records_processed" INTEGER NOT NULL DEFAULT 0,
    "records_inserted" INTEGER NOT NULL DEFAULT 0,
    "records_updated" INTEGER NOT NULL DEFAULT 0,
    "records_failed" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "error_details" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ReferencedProducts" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ReferencedProducts_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_slug_key" ON "product_categories"("slug");

-- CreateIndex
CREATE INDEX "product_categories_slug_idx" ON "product_categories"("slug");

-- CreateIndex
CREATE INDEX "product_categories_parent_id_idx" ON "product_categories"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_agb_code_key" ON "products"("agb_code");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_agb_code_idx" ON "products"("agb_code");

-- CreateIndex
CREATE INDEX "products_sku_idx" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "products_is_available_idx" ON "products"("is_available");

-- CreateIndex
CREATE UNIQUE INDEX "kit_requests_request_number_key" ON "kit_requests"("request_number");

-- CreateIndex
CREATE INDEX "kit_requests_request_number_idx" ON "kit_requests"("request_number");

-- CreateIndex
CREATE INDEX "kit_requests_agent_id_idx" ON "kit_requests"("agent_id");

-- CreateIndex
CREATE INDEX "kit_requests_customer_id_idx" ON "kit_requests"("customer_id");

-- CreateIndex
CREATE INDEX "kit_requests_status_idx" ON "kit_requests"("status");

-- CreateIndex
CREATE INDEX "kit_requests_created_at_idx" ON "kit_requests"("created_at");

-- CreateIndex
CREATE INDEX "kit_requests_window_type_material_series_idx" ON "kit_requests"("window_type", "material", "series");

-- CreateIndex
CREATE INDEX "kit_components_kit_request_id_idx" ON "kit_components"("kit_request_id");

-- CreateIndex
CREATE INDEX "kit_components_product_id_idx" ON "kit_components"("product_id");

-- CreateIndex
CREATE INDEX "kit_components_component_code_idx" ON "kit_components"("component_code");

-- CreateIndex
CREATE INDEX "kit_components_sort_order_idx" ON "kit_components"("sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "kit_components_kit_request_id_component_code_position_key" ON "kit_components"("kit_request_id", "component_code", "position");

-- CreateIndex
CREATE INDEX "kit_templates_window_type_material_series_idx" ON "kit_templates"("window_type", "material", "series");

-- CreateIndex
CREATE INDEX "kit_templates_is_active_idx" ON "kit_templates"("is_active");

-- CreateIndex
CREATE INDEX "kit_templates_priority_idx" ON "kit_templates"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "customers_vat_number_key" ON "customers"("vat_number");

-- CreateIndex
CREATE UNIQUE INDEX "customers_tax_code_key" ON "customers"("tax_code");

-- CreateIndex
CREATE UNIQUE INDEX "customers_customer_code_key" ON "customers"("customer_code");

-- CreateIndex
CREATE INDEX "customers_company_name_idx" ON "customers"("company_name");

-- CreateIndex
CREATE INDEX "customers_vat_number_idx" ON "customers"("vat_number");

-- CreateIndex
CREATE INDEX "customers_customer_code_idx" ON "customers"("customer_code");

-- CreateIndex
CREATE INDEX "conversations_agent_id_idx" ON "conversations"("agent_id");

-- CreateIndex
CREATE INDEX "conversations_status_idx" ON "conversations"("status");

-- CreateIndex
CREATE INDEX "conversations_created_at_idx" ON "conversations"("created_at");

-- CreateIndex
CREATE INDEX "messages_conversation_id_idx" ON "messages"("conversation_id");

-- CreateIndex
CREATE INDEX "messages_role_idx" ON "messages"("role");

-- CreateIndex
CREATE INDEX "messages_created_at_idx" ON "messages"("created_at");

-- CreateIndex
CREATE INDEX "messages_tool_name_idx" ON "messages"("tool_name");

-- CreateIndex
CREATE INDEX "activity_logs_user_id_idx" ON "activity_logs"("user_id");

-- CreateIndex
CREATE INDEX "activity_logs_type_idx" ON "activity_logs"("type");

-- CreateIndex
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs"("created_at");

-- CreateIndex
CREATE INDEX "activity_logs_resource_type_resource_id_idx" ON "activity_logs"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "settings_category_idx" ON "settings"("category");

-- CreateIndex
CREATE UNIQUE INDEX "settings_category_key_key" ON "settings"("category", "key");

-- CreateIndex
CREATE INDEX "sync_logs_sync_type_idx" ON "sync_logs"("sync_type");

-- CreateIndex
CREATE INDEX "sync_logs_status_idx" ON "sync_logs"("status");

-- CreateIndex
CREATE INDEX "sync_logs_created_at_idx" ON "sync_logs"("created_at");

-- CreateIndex
CREATE INDEX "_ReferencedProducts_B_index" ON "_ReferencedProducts"("B");

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_requests" ADD CONSTRAINT "kit_requests_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_requests" ADD CONSTRAINT "kit_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_components" ADD CONSTRAINT "kit_components_kit_request_id_fkey" FOREIGN KEY ("kit_request_id") REFERENCES "kit_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_components" ADD CONSTRAINT "kit_components_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_templates" ADD CONSTRAINT "kit_templates_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ReferencedProducts" ADD CONSTRAINT "_ReferencedProducts_A_fkey" FOREIGN KEY ("A") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ReferencedProducts" ADD CONSTRAINT "_ReferencedProducts_B_fkey" FOREIGN KEY ("B") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════
-- Manual: full-text (Italian) + vector similarity objects.
-- Prisma cannot emit the HNSW operator class (vector_cosine_ops) nor the
-- tsvector trigger, so they are maintained here. These live outside the
-- Prisma model and will surface as "drift" on future `migrate dev` runs.
-- ═══════════════════════════════════════════════════════════════

-- GIN index for Italian full-text search
CREATE INDEX "products_search_vector_idx" ON "products" USING GIN ("search_vector");

-- HNSW index for cosine vector similarity (gemini-embedding-001 @ 768 dims)
CREATE INDEX "products_embedding_idx" ON "products" USING hnsw ("embedding" vector_cosine_ops);

-- Keep search_vector in sync on write (weighted: name > description > short > code)
CREATE OR REPLACE FUNCTION update_product_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('italian', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('italian', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('italian', COALESCE(NEW.short_description, '')), 'C') ||
    setweight(to_tsvector('italian', COALESCE(NEW.agb_code, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_search_vector_update
  BEFORE INSERT OR UPDATE ON "products"
  FOR EACH ROW
  EXECUTE FUNCTION update_product_search_vector();
