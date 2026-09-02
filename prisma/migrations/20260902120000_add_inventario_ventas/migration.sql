CREATE TABLE "tbl_inventario_productos" (
  "id" SERIAL PRIMARY KEY,
  "codigo" VARCHAR(50) NOT NULL UNIQUE,
  "nombre" VARCHAR(150) NOT NULL,
  "categoria" VARCHAR(80) NOT NULL,
  "descripcion" VARCHAR(500),
  "precio_venta" DECIMAL(10,2) NOT NULL,
  "costo_compra" DECIMAL(10,2),
  "stock_minimo" INTEGER NOT NULL DEFAULT 3,
  "foto_url" TEXT,
  "activo" BOOLEAN NOT NULL DEFAULT TRUE,
  "user_id_registration" INTEGER,
  "date_time_registration" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "user_id_modification" INTEGER,
  "date_time_modification" TIMESTAMPTZ
);
CREATE INDEX "tbl_inventario_productos_categoria_activo_idx" ON "tbl_inventario_productos"("categoria", "activo");
CREATE INDEX "tbl_inventario_productos_nombre_idx" ON "tbl_inventario_productos"("nombre");

CREATE TABLE "tbl_inventario_variantes" (
  "id" SERIAL PRIMARY KEY,
  "id_producto" INTEGER NOT NULL REFERENCES "tbl_inventario_productos"("id") ON DELETE CASCADE,
  "nombre" VARCHAR(80) NOT NULL,
  "sku" VARCHAR(80) NOT NULL UNIQUE,
  "stock" INTEGER NOT NULL DEFAULT 0,
  "stock_minimo" INTEGER,
  "activo" BOOLEAN NOT NULL DEFAULT TRUE,
  "date_time_registration" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "tbl_inventario_variantes_id_producto_nombre_key" UNIQUE ("id_producto", "nombre")
);
CREATE INDEX "tbl_inventario_variantes_id_producto_activo_idx" ON "tbl_inventario_variantes"("id_producto", "activo");

CREATE TABLE "tbl_inventario_ventas" (
  "id" SERIAL PRIMARY KEY,
  "codigo" VARCHAR(40) NOT NULL UNIQUE,
  "id_alumno" INTEGER REFERENCES "tbl_alumnos"("id") ON DELETE NO ACTION,
  "tipo" VARCHAR(20) NOT NULL DEFAULT 'VENTA',
  "estado_pago" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
  "total" DECIMAL(10,2) NOT NULL,
  "monto_pagado" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "saldo" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "medio_pago" VARCHAR(30),
  "recibido_por" VARCHAR(150),
  "observacion" VARCHAR(500),
  "registrado_por" INTEGER NOT NULL REFERENCES "tbl_usuarios"("id") ON DELETE NO ACTION,
  "fecha" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "tbl_inventario_ventas_fecha_idx" ON "tbl_inventario_ventas"("fecha");
CREATE INDEX "tbl_inventario_ventas_id_alumno_estado_pago_idx" ON "tbl_inventario_ventas"("id_alumno", "estado_pago");

CREATE TABLE "tbl_inventario_venta_items" (
  "id" SERIAL PRIMARY KEY,
  "id_venta" INTEGER NOT NULL REFERENCES "tbl_inventario_ventas"("id") ON DELETE CASCADE,
  "id_variante" INTEGER NOT NULL REFERENCES "tbl_inventario_variantes"("id") ON DELETE NO ACTION,
  "cantidad" INTEGER NOT NULL,
  "precio_unitario" DECIMAL(10,2) NOT NULL,
  "subtotal" DECIMAL(10,2) NOT NULL
);
CREATE INDEX "tbl_inventario_venta_items_id_venta_idx" ON "tbl_inventario_venta_items"("id_venta");
CREATE INDEX "tbl_inventario_venta_items_id_variante_idx" ON "tbl_inventario_venta_items"("id_variante");

CREATE TABLE "tbl_inventario_movimientos" (
  "id" SERIAL PRIMARY KEY,
  "id_variante" INTEGER NOT NULL REFERENCES "tbl_inventario_variantes"("id") ON DELETE NO ACTION,
  "id_venta" INTEGER REFERENCES "tbl_inventario_ventas"("id") ON DELETE SET NULL,
  "tipo" VARCHAR(20) NOT NULL,
  "cantidad" INTEGER NOT NULL,
  "stock_anterior" INTEGER NOT NULL,
  "stock_nuevo" INTEGER NOT NULL,
  "observacion" VARCHAR(500),
  "registrado_por" INTEGER NOT NULL REFERENCES "tbl_usuarios"("id") ON DELETE NO ACTION,
  "fecha" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "tbl_inventario_movimientos_id_variante_fecha_idx" ON "tbl_inventario_movimientos"("id_variante", "fecha");
CREATE INDEX "tbl_inventario_movimientos_tipo_fecha_idx" ON "tbl_inventario_movimientos"("tipo", "fecha");
