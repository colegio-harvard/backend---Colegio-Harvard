const crypto = require('crypto');
const XLSX = require('xlsx');
const prisma = require('../config/prisma');
const { registrarAuditoria } = require('../middleware/auditMiddleware');

const productoInclude = {
  variantes: { where: { activo: true }, orderBy: { nombre: 'asc' } },
};

const numero = (valor, nombre, minimo = 0) => {
  const value = Number(valor);
  if (!Number.isFinite(value) || value < minimo) throw new Error(`${nombre} inválido`);
  return value;
};
const precioVariante = variante => Number(variante.precio_venta ?? variante.producto?.precio_venta ?? 0);
const costoVariante = variante => Number(variante.costo_compra ?? variante.producto?.costo_compra ?? 0);

const codigoVenta = () => `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

const partesCodigo = value => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim().split(/\s+/)
  .filter(Boolean).slice(0, 2).map(parte => parte.slice(0, 3)).join('-');
const nombreNormalizado = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
const productoConMismoNombre = async (tx, nombre, excluirId = null) => {
  const candidatos = await tx.tbl_inventario_productos.findMany({
    where: { activo: true, ...(excluirId ? { id: { not: excluirId } } : {}) },
    select: { id: true, nombre: true },
  });
  return candidatos.find(producto => nombreNormalizado(producto.nombre) === nombreNormalizado(nombre));
};

const codigoDisponible = async (tx, modelo, campo, base, maximo) => {
  const limpio = String(base || 'ITEM').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, maximo);
  let candidato = limpio;
  let consecutivo = 2;
  while (await tx[modelo].findUnique({ where: { [campo]: candidato }, select: { id: true } })) {
    const sufijo = `-${consecutivo++}`;
    candidato = `${limpio.slice(0, maximo - sufijo.length)}${sufijo}`;
  }
  return candidato;
};

exports.resumen = async (_req, res) => {
  try {
    const [productos, ventasHoy, pendientes] = await Promise.all([
      prisma.tbl_inventario_productos.findMany({ where: { activo: true }, include: productoInclude }),
      prisma.tbl_inventario_ventas.aggregate({
        where: { fecha: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }, tipo: { not: 'RESERVA' } },
        _sum: { total: true }, _count: true,
      }),
      prisma.tbl_inventario_ventas.aggregate({
        where: { estado_pago: { in: ['PENDIENTE', 'PARCIAL'] } }, _sum: { saldo: true }, _count: true,
      }),
    ]);
    const variantes = productos.flatMap(p => p.variantes.map(v => ({ ...v, limite: v.stock_minimo ?? p.stock_minimo, costo: costoVariante({ ...v, producto: p }) })));
    res.json({ data: {
      productos: productos.length,
      unidades: variantes.reduce((s, v) => s + v.stock, 0),
      stock_bajo: variantes.filter(v => v.stock > 0 && v.stock <= v.limite).length,
      agotados: variantes.filter(v => v.stock <= 0).length,
      valor_inventario: variantes.reduce((s, v) => s + (v.stock * v.costo), 0),
      ventas_hoy: Number(ventasHoy._sum.total || 0),
      operaciones_hoy: ventasHoy._count,
      cobros_pendientes: Number(pendientes._sum.saldo || 0),
      ventas_pendientes: pendientes._count,
    } });
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudo cargar el resumen de inventario' }); }
};

exports.listarProductos = async (req, res) => {
  try {
    const incluirInactivos = req.query.incluir_inactivos === 'true';
    const productos = await prisma.tbl_inventario_productos.findMany({
      where: incluirInactivos ? {} : { activo: true },
      include: { variantes: { where: incluirInactivos ? {} : { activo: true }, orderBy: { nombre: 'asc' } } },
      orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }],
    });
    res.json({ data: productos });
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudieron cargar los productos' }); }
};

exports.crearProducto = async (req, res) => {
  try {
    const { codigo, nombre, categoria, descripcion, precio_venta, costo_compra, stock_minimo = 3, foto_url, variantes = [] } = req.body;
    if (!nombre?.trim() || !categoria?.trim()) return res.status(400).json({ error: 'Nombre y categoría son obligatorios' });
    if (!Array.isArray(variantes) || !variantes.length) return res.status(400).json({ error: 'Agregue al menos una talla o variante' });
    const precioBase = numero(variantes[0]?.precio_venta ?? precio_venta, 'Precio de venta');
    const costoBase = variantes[0]?.costo_compra === '' || variantes[0]?.costo_compra == null ? (costo_compra === '' || costo_compra == null ? null : numero(costo_compra, 'Costo de compra')) : numero(variantes[0].costo_compra, 'Costo de compra');
    const producto = await prisma.$transaction(async tx => {
      const duplicado = await productoConMismoNombre(tx, nombre);
      if (duplicado) throw new Error(`El producto “${duplicado.nombre}” ya existe. Selecciónelo para agregar o editar sus variantes.`);
      const codigoProducto = codigo?.trim().toUpperCase() || await codigoDisponible(tx, 'tbl_inventario_productos', 'codigo', `${partesCodigo(categoria)}-${partesCodigo(nombre)}`, 50);
      const creado = await tx.tbl_inventario_productos.create({ data: {
        codigo: codigoProducto, nombre: nombre.trim(), categoria: categoria.trim(), descripcion: descripcion?.trim() || null,
        precio_venta: precioBase, costo_compra: costoBase,
        stock_minimo: Math.trunc(numero(stock_minimo, 'Stock mínimo')), foto_url: foto_url?.trim() || null, user_id_registration: req.user.id,
      } });
      for (const item of variantes) {
        const stock = Math.trunc(numero(item.stock || 0, 'Stock'));
        const nombreVariante = String(item.nombre || 'Única').trim();
        const sku = item.sku?.trim().toUpperCase() || await codigoDisponible(tx, 'tbl_inventario_variantes', 'sku', `${codigoProducto}-${partesCodigo(nombreVariante) || 'UNICA'}`, 80);
        const variante = await tx.tbl_inventario_variantes.create({ data: {
          id_producto: creado.id, nombre: nombreVariante, sku, stock,
          stock_minimo: item.stock_minimo === '' || item.stock_minimo == null ? null : Math.trunc(numero(item.stock_minimo, 'Stock mínimo')),
          precio_venta: numero(item.precio_venta ?? precioBase, 'Precio de venta'),
          costo_compra: item.costo_compra === '' || item.costo_compra == null ? costoBase : numero(item.costo_compra, 'Costo de compra'),
        } });
        if (stock > 0) await tx.tbl_inventario_movimientos.create({ data: { id_variante: variante.id, tipo: 'INGRESO', cantidad: stock, stock_anterior: 0, stock_nuevo: stock, observacion: 'Stock inicial', registrado_por: req.user.id } });
      }
      return tx.tbl_inventario_productos.findUnique({ where: { id: creado.id }, include: productoInclude });
    });
    await registrarAuditoria({ userId: req.user.id, accion: 'CREAR_PRODUCTO_INVENTARIO', tipoEntidad: 'tbl_inventario_productos', idEntidad: producto.id, resumen: `Producto creado: ${producto.nombre}`, req });
    res.status(201).json({ data: producto });
  } catch (error) {
    console.error(error);
    res.status(error.code === 'P2002' ? 409 : 400).json({ error: error.code === 'P2002' ? 'El código o SKU ya existe' : error.message || 'No se pudo crear el producto' });
  }
};

exports.actualizarProducto = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { codigo, nombre, categoria, descripcion, precio_venta, costo_compra, stock_minimo = 3, foto_url, activo, variantes = [] } = req.body;
    if (!Array.isArray(variantes) || !variantes.length) return res.status(400).json({ error: 'Agregue al menos una talla o variante' });
    const precioBase = numero(variantes[0]?.precio_venta ?? precio_venta, 'Precio de venta');
    const costoBase = variantes[0]?.costo_compra === '' || variantes[0]?.costo_compra == null ? (costo_compra === '' || costo_compra == null ? null : numero(costo_compra, 'Costo de compra')) : numero(variantes[0].costo_compra, 'Costo de compra');
    const producto = await prisma.$transaction(async tx => {
      const actual = await tx.tbl_inventario_productos.findUnique({ where: { id }, select: { nombre: true } });
      if (!actual) throw new Error('Producto no encontrado');
      if (nombreNormalizado(actual.nombre) !== nombreNormalizado(nombre)) {
        const duplicado = await productoConMismoNombre(tx, nombre, id);
        if (duplicado) throw new Error(`El producto “${duplicado.nombre}” ya existe. Selecciónelo para agregar o editar sus variantes.`);
      }
      await tx.tbl_inventario_productos.update({ where: { id }, data: {
        codigo: codigo?.trim().toUpperCase(), nombre: nombre?.trim(), categoria: categoria?.trim(), descripcion: descripcion?.trim() || null,
        precio_venta: precioBase, costo_compra: costoBase,
        stock_minimo: Math.trunc(numero(stock_minimo, 'Stock mínimo')), foto_url: foto_url?.trim() || null, activo: activo !== false,
        user_id_modification: req.user.id, date_time_modification: new Date(),
      } });
      for (const item of variantes) {
        if (item.id) await tx.tbl_inventario_variantes.update({ where: { id: Number(item.id) }, data: { nombre: item.nombre.trim(), sku: item.sku.trim().toUpperCase(), stock_minimo: item.stock_minimo === '' || item.stock_minimo == null ? null : Math.trunc(numero(item.stock_minimo, 'Stock mínimo')), precio_venta: numero(item.precio_venta ?? precioBase, 'Precio de venta'), costo_compra: item.costo_compra === '' || item.costo_compra == null ? costoBase : numero(item.costo_compra, 'Costo de compra'), activo: item.activo !== false } });
        else {
          const productoActual = await tx.tbl_inventario_productos.findUnique({ where: { id }, select: { codigo: true } });
          const sku = item.sku?.trim().toUpperCase() || await codigoDisponible(tx, 'tbl_inventario_variantes', 'sku', `${productoActual.codigo}-${partesCodigo(item.nombre) || 'UNICA'}`, 80);
          const stock = Math.trunc(numero(item.stock || 0, 'Stock actual'));
          const variante = await tx.tbl_inventario_variantes.create({ data: { id_producto: id, nombre: item.nombre.trim(), sku, stock, stock_minimo: item.stock_minimo === '' || item.stock_minimo == null ? null : Math.trunc(numero(item.stock_minimo, 'Stock mínimo')), precio_venta: numero(item.precio_venta ?? precioBase, 'Precio de venta'), costo_compra: item.costo_compra === '' || item.costo_compra == null ? costoBase : numero(item.costo_compra, 'Costo de compra') } });
          if (stock > 0) await tx.tbl_inventario_movimientos.create({ data: { id_variante: variante.id, tipo: 'INGRESO', cantidad: stock, stock_anterior: 0, stock_nuevo: stock, observacion: 'Stock inicial de variante', registrado_por: req.user.id } });
        }
      }
      return tx.tbl_inventario_productos.findUnique({ where: { id }, include: productoInclude });
    });
    res.json({ data: producto });
  } catch (error) { console.error(error); res.status(error.code === 'P2002' ? 409 : 400).json({ error: error.code === 'P2002' ? 'El código o SKU ya existe' : error.message || 'No se pudo actualizar el producto' }); }
};

exports.archivarProducto = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const producto = await prisma.$transaction(async tx => {
      const actual = await tx.tbl_inventario_productos.findUnique({ where: { id }, select: { id: true, nombre: true } });
      if (!actual) throw new Error('Producto no encontrado');
      await tx.tbl_inventario_productos.update({ where: { id }, data: { activo: false, user_id_modification: req.user.id, date_time_modification: new Date() } });
      await tx.tbl_inventario_variantes.updateMany({ where: { id_producto: id }, data: { activo: false } });
      return actual;
    });
    await registrarAuditoria({ userId: req.user.id, accion: 'ARCHIVAR_PRODUCTO_INVENTARIO', tipoEntidad: 'tbl_inventario_productos', idEntidad: id, resumen: `Producto archivado: ${producto.nombre}`, req });
    res.json({ data: producto });
  } catch (error) { console.error(error); res.status(400).json({ error: error.message || 'No se pudo archivar el producto' }); }
};

exports.restaurarProducto = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const producto = await prisma.$transaction(async tx => {
      const actual = await tx.tbl_inventario_productos.findUnique({ where: { id }, select: { id: true, nombre: true, activo: true } });
      if (!actual) throw new Error('Producto no encontrado');
      if (actual.activo) throw new Error('El producto ya está activo');
      const duplicado = await productoConMismoNombre(tx, actual.nombre, id);
      if (duplicado) throw new Error(`Ya existe el producto activo “${duplicado.nombre}”. Fusiónelo o mantenga este producto archivado para evitar duplicados.`);
      await tx.tbl_inventario_productos.update({ where: { id }, data: { activo: true, user_id_modification: req.user.id, date_time_modification: new Date() } });
      await tx.tbl_inventario_variantes.updateMany({ where: { id_producto: id }, data: { activo: true } });
      return actual;
    });
    await registrarAuditoria({ userId: req.user.id, accion: 'RESTAURAR_PRODUCTO_INVENTARIO', tipoEntidad: 'tbl_inventario_productos', idEntidad: id, resumen: `Producto restaurado: ${producto.nombre}`, req });
    res.json({ data: producto });
  } catch (error) { console.error(error); res.status(400).json({ error: error.message || 'No se pudo restaurar el producto' }); }
};

exports.eliminarProducto = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const producto = await prisma.tbl_inventario_productos.findUnique({ where: { id }, select: { id: true, nombre: true } });
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    const [movimientos, ventas] = await Promise.all([
      prisma.tbl_inventario_movimientos.count({ where: { variante: { id_producto: id } } }),
      prisma.tbl_inventario_venta_items.count({ where: { variante: { id_producto: id } } }),
    ]);
    if (movimientos || ventas) return res.status(409).json({ error: 'Este producto tiene historial. Use Archivar para conservarlo sin mostrarlo en el inventario.' });
    await prisma.tbl_inventario_productos.delete({ where: { id } });
    await registrarAuditoria({ userId: req.user.id, accion: 'ELIMINAR_PRODUCTO_INVENTARIO', tipoEntidad: 'tbl_inventario_productos', idEntidad: id, resumen: `Producto eliminado: ${producto.nombre}`, req });
    res.json({ data: producto });
  } catch (error) { console.error(error); res.status(400).json({ error: error.message || 'No se pudo eliminar el producto' }); }
};

exports.fusionarProducto = async (req, res) => {
  try {
    const origenId = Number(req.params.id);
    const destinoId = Number(req.body.id_destino);
    if (!origenId || !destinoId || origenId === destinoId) return res.status(400).json({ error: 'Seleccione dos productos distintos para fusionar' });
    const resultado = await prisma.$transaction(async tx => {
      const [origen, destino] = await Promise.all([
        tx.tbl_inventario_productos.findUnique({ where: { id: origenId }, include: { variantes: true } }),
        tx.tbl_inventario_productos.findUnique({ where: { id: destinoId }, include: { variantes: true } }),
      ]);
      if (!origen || !destino || !origen.activo || !destino.activo) throw new Error('Uno de los productos ya no está disponible');
      if (nombreNormalizado(origen.nombre) !== nombreNormalizado(destino.nombre)) throw new Error('Solo se pueden fusionar productos con el mismo nombre');
      for (const varianteOrigen of origen.variantes) {
        const varianteDestino = destino.variantes.find(variante => nombreNormalizado(variante.nombre) === nombreNormalizado(varianteOrigen.nombre));
        if (!varianteDestino) {
          await tx.tbl_inventario_variantes.update({ where: { id: varianteOrigen.id }, data: { id_producto: destino.id } });
          continue;
        }
        await tx.tbl_inventario_movimientos.updateMany({ where: { id_variante: varianteOrigen.id }, data: { id_variante: varianteDestino.id } });
        await tx.tbl_inventario_venta_items.updateMany({ where: { id_variante: varianteOrigen.id }, data: { id_variante: varianteDestino.id } });
        await tx.tbl_inventario_variantes.update({ where: { id: varianteDestino.id }, data: { stock: varianteDestino.stock + varianteOrigen.stock } });
        await tx.tbl_inventario_variantes.delete({ where: { id: varianteOrigen.id } });
      }
      await tx.tbl_inventario_productos.delete({ where: { id: origen.id } });
      return { origen: origen.nombre, destino: destino.nombre, variantes: origen.variantes.length };
    });
    await registrarAuditoria({ userId: req.user.id, accion: 'FUSIONAR_PRODUCTOS_INVENTARIO', tipoEntidad: 'tbl_inventario_productos', idEntidad: destinoId, resumen: `Producto fusionado: ${resultado.origen} en ${resultado.destino} (${resultado.variantes} variante(s))`, req });
    res.json({ data: resultado });
  } catch (error) { console.error(error); res.status(400).json({ error: error.message || 'No se pudo fusionar el producto' }); }
};

exports.renombrarCategoria = async (req, res) => {
  try {
    const anterior = decodeURIComponent(req.params.nombre || '').trim();
    const nueva = String(req.body.nombre || '').trim();
    if (!anterior || !nueva) return res.status(400).json({ error: 'Indique el nuevo nombre de la categoría' });
    const productos = await prisma.tbl_inventario_productos.findMany({ where: { activo: true }, select: { id: true, categoria: true } });
    const afectados = productos.filter(producto => nombreNormalizado(producto.categoria) === nombreNormalizado(anterior));
    if (!afectados.length) return res.status(404).json({ error: 'Categoría no encontrada' });
    const existeOtra = productos.some(producto => nombreNormalizado(producto.categoria) === nombreNormalizado(nueva) && nombreNormalizado(producto.categoria) !== nombreNormalizado(anterior));
    if (existeOtra) return res.status(409).json({ error: 'Ya existe una categoría con ese nombre' });
    await prisma.tbl_inventario_productos.updateMany({ where: { id: { in: afectados.map(producto => producto.id) } }, data: { categoria: nueva, user_id_modification: req.user.id, date_time_modification: new Date() } });
    await registrarAuditoria({ userId: req.user.id, accion: 'RENOMBRAR_CATEGORIA_INVENTARIO', tipoEntidad: 'categoria_inventario', resumen: `Categoría renombrada: ${anterior} → ${nueva}`, req });
    res.json({ data: { anterior, nombre: nueva, productos_actualizados: afectados.length } });
  } catch (error) { console.error(error); res.status(400).json({ error: error.message || 'No se pudo renombrar la categoría' }); }
};

exports.registrarMovimiento = async (req, res) => {
  try {
    const { id_variante, tipo, cantidad, stock_nuevo, observacion } = req.body;
    if (!['INGRESO', 'SALIDA', 'DEVOLUCION', 'AJUSTE'].includes(tipo)) return res.status(400).json({ error: 'Tipo de movimiento inválido' });
    const resultado = await prisma.$transaction(async tx => {
      const variante = await tx.tbl_inventario_variantes.findUnique({ where: { id: Number(id_variante) } });
      if (!variante) throw new Error('Variante no encontrada');
      const qty = tipo === 'AJUSTE' ? Math.abs(Math.trunc(numero(stock_nuevo, 'Nuevo stock'))) : Math.trunc(numero(cantidad, 'Cantidad', 1));
      const siguiente = tipo === 'AJUSTE' ? qty : variante.stock + (['INGRESO', 'DEVOLUCION'].includes(tipo) ? qty : -qty);
      if (siguiente < 0) throw new Error('Stock insuficiente para realizar la salida');
      await tx.tbl_inventario_variantes.update({ where: { id: variante.id }, data: { stock: siguiente } });
      return tx.tbl_inventario_movimientos.create({ data: { id_variante: variante.id, tipo, cantidad: tipo === 'AJUSTE' ? Math.abs(siguiente - variante.stock) : qty, stock_anterior: variante.stock, stock_nuevo: siguiente, observacion: observacion?.trim() || null, registrado_por: req.user.id } });
    });
    res.status(201).json({ data: resultado });
  } catch (error) { console.error(error); res.status(400).json({ error: error.message || 'No se pudo registrar el movimiento' }); }
};

exports.listarMovimientos = async (_req, res) => {
  try {
    const data = await prisma.tbl_inventario_movimientos.findMany({ include: { variante: { include: { producto: true } }, usuario: { select: { nombres: true } }, venta: { select: { codigo: true } } }, orderBy: { fecha: 'desc' }, take: 500 });
    res.json({ data });
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudieron cargar los movimientos' }); }
};

exports.crearVenta = async (req, res) => {
  try {
    const { id_alumno, tipo = 'VENTA', monto_pagado = 0, medio_pago, recibido_por, comprador_nombre, comprador_celular, observacion, items = [] } = req.body;
    if (!['VENTA', 'GRATUITA', 'RESERVA'].includes(tipo)) return res.status(400).json({ error: 'Tipo de operación inválido' });
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Agregue al menos un producto' });
    const celularLimpio = String(comprador_celular || '').replace(/\D/g, '');
    if (!id_alumno && !comprador_nombre?.trim()) return res.status(400).json({ error: 'Ingrese el nombre del comprador' });
    if (celularLimpio && !/^(?:51)?9\d{8}$/.test(celularLimpio)) return res.status(400).json({ error: 'Ingrese un celular peruano válido de 9 dígitos' });
    const venta = await prisma.$transaction(async tx => {
      const alumno = id_alumno ? await tx.tbl_alumnos.findUnique({
        where: { id: Number(id_alumno) },
        include: { tbl_padres_alumnos: { include: { tbl_padres: { select: { nombre_completo: true, celular: true } } } } },
      }) : null;
      if (id_alumno && !alumno) throw new Error('Alumno no encontrado');
      const apoderado = alumno?.tbl_padres_alumnos?.tbl_padres;
      const nombreComprador = comprador_nombre?.trim() || apoderado?.nombre_completo || alumno?.nombre_completo || null;
      const celularComprador = celularLimpio || String(apoderado?.celular || '').replace(/\D/g, '') || null;
      const ids = [...new Set(items.map(x => Number(x.id_variante)))];
      const variantes = await tx.tbl_inventario_variantes.findMany({ where: { id: { in: ids }, activo: true }, include: { producto: true } });
      if (variantes.length !== ids.length) throw new Error('Uno de los productos ya no está disponible');
      const mapa = new Map(variantes.map(v => [v.id, v]));
      const detalles = items.map(item => {
        const variante = mapa.get(Number(item.id_variante));
        const cantidad = Math.trunc(numero(item.cantidad, 'Cantidad', 1));
        if (variante.stock < cantidad) throw new Error(`Stock insuficiente para ${variante.producto.nombre} · ${variante.nombre}`);
        const precio = tipo === 'GRATUITA' ? 0 : precioVariante(variante);
        return { variante, cantidad, precio, subtotal: precio * cantidad };
      });
      const total = detalles.reduce((s, x) => s + x.subtotal, 0);
      const pagado = tipo === 'GRATUITA' ? 0 : Math.min(numero(monto_pagado, 'Monto pagado'), total);
      const saldo = total - pagado;
      const estadoPago = tipo === 'GRATUITA' ? 'NO_APLICA' : saldo <= 0 ? 'PAGADO' : pagado > 0 ? 'PARCIAL' : 'PENDIENTE';
      const creada = await tx.tbl_inventario_ventas.create({ data: { codigo: codigoVenta(), id_alumno: id_alumno ? Number(id_alumno) : null, tipo, estado_pago: estadoPago, total, monto_pagado: pagado, saldo, medio_pago: medio_pago || null, recibido_por: recibido_por?.trim() || null, comprador_nombre: nombreComprador, comprador_celular: celularComprador, observacion: observacion?.trim() || null, registrado_por: req.user.id } });
      for (const detalle of detalles) {
        const descuento = await tx.tbl_inventario_variantes.updateMany({ where: { id: detalle.variante.id, stock: { gte: detalle.cantidad } }, data: { stock: { decrement: detalle.cantidad } } });
        if (descuento.count !== 1) throw new Error(`El stock de ${detalle.variante.producto.nombre} cambió; revise la cantidad disponible`);
        const actualizado = await tx.tbl_inventario_variantes.findUnique({ where: { id: detalle.variante.id } });
        await tx.tbl_inventario_venta_items.create({ data: { id_venta: creada.id, id_variante: detalle.variante.id, cantidad: detalle.cantidad, precio_unitario: detalle.precio, subtotal: detalle.subtotal } });
        await tx.tbl_inventario_movimientos.create({ data: { id_variante: detalle.variante.id, id_venta: creada.id, tipo: tipo === 'RESERVA' ? 'RESERVA' : 'VENTA', cantidad: detalle.cantidad, stock_anterior: actualizado.stock + detalle.cantidad, stock_nuevo: actualizado.stock, observacion: observacion?.trim() || null, registrado_por: req.user.id } });
      }
      return tx.tbl_inventario_ventas.findUnique({ where: { id: creada.id }, include: { alumno: { select: { codigo_alumno: true, nombre_completo: true } }, items: { include: { variante: { include: { producto: true } } } } } });
    });
    await registrarAuditoria({ userId: req.user.id, accion: 'REGISTRAR_VENTA_INVENTARIO', tipoEntidad: 'tbl_inventario_ventas', idEntidad: venta.id, resumen: `Operación ${venta.codigo} registrada por S/ ${venta.total}`, req });
    res.status(201).json({ data: venta });
  } catch (error) { console.error(error); res.status(400).json({ error: error.message || 'No se pudo registrar la venta' }); }
};

exports.obtenerRecibo = async (req, res) => {
  try {
    const venta = await prisma.tbl_inventario_ventas.findUnique({
      where: { codigo: req.params.codigo },
      include: { alumno: { select: { codigo_alumno: true, nombre_completo: true, dni: true } }, items: { include: { variante: { include: { producto: true } } } }, usuario: { select: { nombres: true } } },
    });
    if (!venta) return res.status(404).json({ error: 'Recibo no encontrado' });
    res.json({ data: venta });
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudo consultar el recibo' }); }
};

exports.listarVentas = async (_req, res) => {
  try {
    const data = await prisma.tbl_inventario_ventas.findMany({ include: { alumno: { select: { codigo_alumno: true, nombre_completo: true, dni: true } }, usuario: { select: { nombres: true } }, items: { include: { variante: { include: { producto: true } } } } }, orderBy: { fecha: 'desc' }, take: 500 });
    res.json({ data });
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudieron cargar las ventas' }); }
};

const construirReporte = async (query = {}) => {
  const where = { tipo: { not: 'RESERVA' } };
  if (query.desde || query.hasta) {
    where.fecha = {};
    if (query.desde) where.fecha.gte = new Date(`${query.desde}T00:00:00-05:00`);
    if (query.hasta) where.fecha.lte = new Date(`${query.hasta}T23:59:59.999-05:00`);
  }
  if (query.medio_pago) where.medio_pago = query.medio_pago;
  const ventas = await prisma.tbl_inventario_ventas.findMany({
    where,
    include: { alumno: { select: { codigo_alumno: true, nombre_completo: true } }, usuario: { select: { nombres: true } }, items: { include: { variante: { include: { producto: true } } } } },
    orderBy: { fecha: 'desc' },
  });
  const operaciones = ventas.map(venta => {
    const items = venta.items.filter(item => (!query.categoria || item.variante.producto.categoria === query.categoria) && (!query.id_producto || item.variante.producto.id === Number(query.id_producto)));
    if (!items.length) return null;
    const totalFiltrado = items.reduce((s, item) => s + Number(item.subtotal), 0);
    const proporcion = Number(venta.total) > 0 ? totalFiltrado / Number(venta.total) : 0;
    const pagado = Number(venta.monto_pagado) * proporcion;
    const costo = items.reduce((s, item) => s + costoVariante(item.variante) * item.cantidad, 0);
    return { ...venta, items, total_reporte: totalFiltrado, pagado_reporte: pagado, saldo_reporte: Math.max(0, totalFiltrado - pagado), costo_reporte: costo, utilidad_reporte: totalFiltrado - costo };
  }).filter(Boolean);
  const sumar = campo => operaciones.reduce((s, venta) => s + Number(venta[campo] || 0), 0);
  const porMedio = Object.entries(operaciones.reduce((acc, venta) => { const key = venta.medio_pago || 'SIN ESPECIFICAR'; acc[key] = (acc[key] || 0) + venta.pagado_reporte; return acc; }, {})).map(([medio, monto]) => ({ medio, monto }));
  const porCategoria = Object.entries(operaciones.flatMap(v => v.items).reduce((acc, item) => { const key = item.variante.producto.categoria; acc[key] = (acc[key] || 0) + Number(item.subtotal); return acc; }, {})).map(([categoria, total]) => ({ categoria, total }));
  return { resumen: { operaciones: operaciones.length, ventas: sumar('total_reporte'), ingresos: sumar('pagado_reporte'), pendientes: sumar('saldo_reporte'), costos: sumar('costo_reporte'), utilidad_estimada: sumar('utilidad_reporte') }, por_medio: porMedio, por_categoria: porCategoria, operaciones };
};

exports.reporteEconomico = async (req, res) => {
  try { res.json({ data: await construirReporte(req.query) }); }
  catch (error) { console.error(error); res.status(500).json({ error: 'No se pudo generar el reporte económico de inventario' }); }
};

exports.exportarReporte = async (req, res) => {
  try {
    const reporte = await construirReporte(req.query);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Concepto: 'Total vendido', Monto: reporte.resumen.ventas }, { Concepto: 'Ingresos cobrados', Monto: reporte.resumen.ingresos }, { Concepto: 'Saldos pendientes', Monto: reporte.resumen.pendientes }, { Concepto: 'Costo estimado', Monto: reporte.resumen.costos }, { Concepto: 'Utilidad estimada', Monto: reporte.resumen.utilidad_estimada }]), 'Resumen económico');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reporte.operaciones.map(v => ({ Fecha: v.fecha, Código: v.codigo, Comprador: v.comprador_nombre || v.alumno?.nombre_completo || '', Productos: v.items.map(i => `${i.variante.producto.nombre} ${i.variante.nombre} x${i.cantidad}`).join(', '), 'Medio de pago': v.medio_pago || '', Vendido: v.total_reporte, Cobrado: v.pagado_reporte, Pendiente: v.saldo_reporte, Costo: v.costo_reporte, 'Utilidad estimada': v.utilidad_reporte, Usuario: v.usuario.nombres }))), 'Operaciones');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reporte.por_medio.map(x => ({ 'Medio de pago': x.medio, 'Monto cobrado': x.monto }))), 'Medios de pago');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename="reporte-economico-inventario-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(buffer);
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudo exportar el reporte económico' }); }
};

exports.exportar = async (_req, res) => {
  try {
    const [productos, movimientos, ventas] = await Promise.all([
      prisma.tbl_inventario_productos.findMany({ include: productoInclude, orderBy: { nombre: 'asc' } }),
      prisma.tbl_inventario_movimientos.findMany({ include: { variante: { include: { producto: true } }, usuario: { select: { nombres: true } } }, orderBy: { fecha: 'desc' } }),
      prisma.tbl_inventario_ventas.findMany({ include: { alumno: { select: { codigo_alumno: true, nombre_completo: true } } }, orderBy: { fecha: 'desc' } }),
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productos.flatMap(p => p.variantes.map(v => ({ Código: p.codigo, Producto: p.nombre, Categoría: p.categoria, Variante: v.nombre, SKU: v.sku, Stock: v.stock, 'Stock mínimo': v.stock_minimo ?? p.stock_minimo, 'Precio venta': precioVariante({ ...v, producto: p }), 'Costo compra': costoVariante({ ...v, producto: p }), Estado: !v.activo ? 'INACTIVO' : v.stock <= 0 ? 'AGOTADO' : v.stock <= (v.stock_minimo ?? p.stock_minimo) ? 'STOCK BAJO' : 'DISPONIBLE' })))), 'Inventario');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(movimientos.map(m => ({ Fecha: m.fecha, Tipo: m.tipo, Producto: m.variante.producto.nombre, Variante: m.variante.nombre, Cantidad: m.cantidad, 'Stock anterior': m.stock_anterior, 'Stock nuevo': m.stock_nuevo, Usuario: m.usuario.nombres, Observación: m.observacion || '' }))), 'Movimientos');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ventas.map(v => ({ Fecha: v.fecha, Código: v.codigo, Alumno: v.alumno?.nombre_completo || '', 'Código alumno': v.alumno?.codigo_alumno || '', Tipo: v.tipo, 'Estado pago': v.estado_pago, Total: Number(v.total), Pagado: Number(v.monto_pagado), Saldo: Number(v.saldo), 'Medio de pago': v.medio_pago || '' }))), 'Ventas');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename="inventario-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(buffer);
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudo exportar el inventario' }); }
};
