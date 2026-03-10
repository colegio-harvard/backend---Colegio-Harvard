const jwt = require('jsonwebtoken');
require('dotenv').config();

const token = jwt.sign(
  { id: 1, correo: 'admin@demo.com', rol: 'admin' },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

console.log(token);
