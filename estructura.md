# Estructura del Proyecto Full Stack

## Backend (Node.js + Express + Prisma)

```
backend/
├── config/
│   └── db.js                        # Configuración de base de datos
├── controllers/
│   └── authController.js            # Controlador de autenticación
│   └── [entidad]Controller.js       # Controladores por entidad
├── middleware/
│   └── authMiddleware.js            # Middleware de autenticación
│   └── [otro]Middleware.js          # Otros middlewares (validación, permisos, etc.)
├── models/
│   └── authModel.js                 # Modelo de autenticación
│   └── [entidad]Model.js            # Modelos por entidad
├── prisma/
│   ├── migrations/                  # Migraciones de base de datos
│   ├── schema.prisma                # Esquema de Prisma (definición de BD)
│   └── seed.js                      # Datos semilla
├── routes/
│   └── authRoutes.js                # Rutas de autenticación
│   └── [entidad]Routes.js           # Rutas por entidad
├── uploads/
│   └── documents/                   # Archivos subidos por usuarios
├── .env                             # Variables de entorno
├── index.js                         # Punto de entrada principal
└── package.json                     # Dependencias del proyecto
```

---

## Frontend (React + Vite + Tailwind)

```
frontend/
└── src/
    │
    ├── components/                      # Componentes UI reutilizables
    │   ├── common/                      # Componentes genéricos (botones, tablas, inputs, modales)
    │   ├── layout/                      # Estructura visual (Navbar, Sidebar, Footer)
    │   └── [Entidad]/                   # Componentes específicos por entidad
    │       ├── Formulario[Entidad].jsx  # Formulario dinámico para crear/editar
    │       ├── Tabla[Entidad].jsx       # Tabla con listado de registros
    │       ├── Detalle[Entidad].jsx     # Vista detalle de un registro
    │       └── Modal[Entidad].jsx       # Modal reutilizable de la entidad
    │
    ├── modules/                         # Módulos grandes (ej: compras, ventas)
    │   ├── [ModuloA]/                   # Lógica, vistas y subcomponentes del Módulo A
    │   └── [ModuloB]/                   # Lógica, vistas y subcomponentes del Módulo B
    │
    ├── features/                        # Funcionalidades transversales
    │   ├── auth/                        # Inicio de sesión, manejo de token, sesión
    │   ├── notificaciones/              # Sistema de notificaciones in-app o toast
    │   └── permisos/                    # Control de accesos, roles y permisos
    │
    ├── hooks/                           # Hooks reutilizables y personalizados
    │   ├── useApi/                      # Hooks para conexión real a APIs
    │   │   ├── useAuthApi.js            # Hook para autenticación
    │   │   └── use[Entidad]Api.js       # Hook específico CRUD por entidad
    │   ├── usePagination.js             # Lógica de paginación reutilizable
    │   ├── useFilters.js                # Lógica de filtrado reutilizable
    │   ├── useFormValidation.js         # Validación desacoplada para formularios
    │   └── useDebounce.js               # Control de tiempo para inputs
    │
    ├── services/                        # Comunicación con el backend
    │   ├── apiClient.js                 # Configuración base de cliente HTTP (axios)
    │   ├── authService.js               # Funciones para login, registro, logout
    │   └── [entidad]Service.js          # CRUD de la entidad en API real
    │
    ├── utils/                           # Funciones utilitarias, esquemas, validadores
    │   ├── constants.js                 # Constantes globales (estados, rutas, claves)
    │   ├── schemas/                     # Esquemas para formularios dinámicos
    │   │   └── [entidad]Schema.js       # Esquema del formulario de la entidad
    │   ├── validators/                  # Validadores de campos o lógica de negocio
    │   │   └── [entidad]Validation.js   # Validación personalizada para la entidad
    │   └── formatters.js                # Funciones para formatear fechas, monedas, strings
    │
    ├── styles/                          # Estilos globales y configuración de Tailwind
    │   ├── tailwind.css                 # Importación y configuración base de Tailwind
    │   └── globals.css                  # Estilos globales adicionales
    │
    ├── assets/                          # Archivos estáticos
    │   └── logo.svg                     # Logo de la aplicación
    │
    ├── pages/                           # Vistas agrupadas por ruta
    │   ├── Login.jsx                    # Vista de login
    │   ├── Dashboard.jsx                # Dashboard principal
    │   └── [entidad]/                   # Páginas relacionadas a una entidad
    │       ├── index.jsx                # Vista listado principal
    │       ├── nuevo.jsx                # Formulario para crear nuevo registro
    │       ├── editar.jsx               # Formulario para editar registro
    │       └── detalle.jsx              # Vista detalle de un registro
    │
    ├── routes/                          # Sistema de rutas de la app
    │   └── AppRoutes.jsx                # Archivo central de definición de rutas
    │
    ├── App.jsx                          # Componente raíz de React
    └── main.jsx                         # Inicialización de la app
```

---

## Flujo de Datos (Full Stack)

```
┌─────────────────────────────────────────────────────────────────────┐
│                           FRONTEND                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐      │
│  │  Pages   │───▶│  Hooks   │───▶│ Services │───▶│ apiClient│      │
│  │  (UI)    │    │ useApi   │    │  CRUD    │    │  (axios) │      │
│  └──────────┘    └──────────┘    └──────────┘    └────┬─────┘      │
└───────────────────────────────────────────────────────┼─────────────┘
                                                        │ HTTP
                                                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            BACKEND                                  │
│  ┌──────────┐    ┌────────────┐    ┌──────────┐    ┌──────────┐    │
│  │  Routes  │───▶│ Middleware │───▶│Controller│───▶│  Model   │    │
│  │  (API)   │    │   (Auth)   │    │ (Lógica) │    │ (Prisma) │    │
│  └──────────┘    └────────────┘    └──────────┘    └────┬─────┘    │
└──────────────────────────────────────────────────────────┼──────────┘
                                                           │
                                                           ▼
                                                    ┌──────────────┐
                                                    │  PostgreSQL  │
                                                    │   Database   │
                                                    └──────────────┘
```
