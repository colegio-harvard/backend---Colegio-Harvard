jest.mock('../config/prisma', () => ({
  tbl_colegio: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
}));

const prisma = require('../config/prisma');
const { actualizarColegio } = require('../controllers/configEscolarController');

const ejecutar = async (body) => {
  const req = { body, user: { id: 1 } };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  await actualizarColegio(req, res);
  return { res };
};

describe('actualizarColegio', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.tbl_colegio.findFirst.mockResolvedValue({ id: 1, nombre: 'Colegio Fernando' });
    prisma.tbl_colegio.update.mockResolvedValue({ id: 1, nombre: 'Colegio Harvard' });
  });

  test('actualiza el nombre institucional conservando el registro existente', async () => {
    const { res } = await ejecutar({ nombre: '  Colegio Harvard  ' });

    expect(prisma.tbl_colegio.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 1 },
      data: expect.objectContaining({ nombre: 'Colegio Harvard', user_id_modification: 1 }),
    }));
    expect(res.json).toHaveBeenCalledWith({ mensaje: 'Datos del colegio actualizados' });
  });

  test('rechaza un nombre vacío sin actualizar', async () => {
    const { res } = await ejecutar({ nombre: '   ' });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.tbl_colegio.update).not.toHaveBeenCalled();
  });
});
