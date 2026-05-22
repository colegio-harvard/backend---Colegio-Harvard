ALTER TABLE "tbl_pagos_pension"
ADD COLUMN IF NOT EXISTS "codigo_ticket" VARCHAR(40),
ADD COLUMN IF NOT EXISTS "ticket_json" JSONB,
ADD COLUMN IF NOT EXISTS "emitido_en" TIMESTAMPTZ(6) DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS "tbl_pagos_pension_codigo_ticket_key"
ON "tbl_pagos_pension"("codigo_ticket")
WHERE "codigo_ticket" IS NOT NULL;
