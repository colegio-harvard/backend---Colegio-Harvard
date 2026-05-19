-- AlterTable: Replace pagado boolean with estado string + monto fields
ALTER TABLE "tbl_estado_pension" ADD COLUMN "estado" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE';
ALTER TABLE "tbl_estado_pension" ADD COLUMN "monto_total" DECIMAL(10,2);
ALTER TABLE "tbl_estado_pension" ADD COLUMN "monto_pagado" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Migrate existing data: pagado=true -> estado='PAGADO'
UPDATE "tbl_estado_pension" SET "estado" = 'PAGADO' WHERE "pagado" = true;
UPDATE "tbl_estado_pension" SET "estado" = 'PENDIENTE' WHERE "pagado" = false;

-- Drop old column
ALTER TABLE "tbl_estado_pension" DROP COLUMN "pagado";

-- CreateTable: historial de pagos
CREATE TABLE "tbl_pagos_pension" (
    "id" SERIAL NOT NULL,
    "id_estado_pension" INTEGER NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "fecha_pago" DATE NOT NULL,
    "observacion" VARCHAR(255),
    "registrado_por" INTEGER NOT NULL,
    "user_id_registration" INTEGER,
    "date_time_registration" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_pagos_pension_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "tbl_pagos_pension" ADD CONSTRAINT "tbl_pagos_pension_id_estado_pension_fkey" FOREIGN KEY ("id_estado_pension") REFERENCES "tbl_estado_pension"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_pagos_pension" ADD CONSTRAINT "tbl_pagos_pension_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "tbl_usuarios"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
