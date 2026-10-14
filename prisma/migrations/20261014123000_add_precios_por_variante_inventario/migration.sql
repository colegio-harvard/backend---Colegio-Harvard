ALTER TABLE "tbl_inventario_variantes"
  ADD COLUMN "precio_venta" DECIMAL(10,2),
  ADD COLUMN "costo_compra" DECIMAL(10,2);

UPDATE "tbl_inventario_variantes" AS variante
SET "precio_venta" = producto."precio_venta",
    "costo_compra" = producto."costo_compra"
FROM "tbl_inventario_productos" AS producto
WHERE producto."id" = variante."id_producto";
