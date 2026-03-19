# CLAUDE.md — SGPM (Sistema de Gestión de Paros de Máquinas)

## Descripción del proyecto

Sistema web para registrar y gestionar paros de máquinas en planta industrial.
Permite a operadores reportar paros, a supervisores monitorearlos en tiempo real,
y a administradores ver reportes, historial y métricas OEE.

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React + Vite + TailwindCSS |
| Backend | Node.js + Express + Socket.io |
| Base de datos | MySQL 8 + Sequelize ORM |
| Autenticación | JWT |
| Servidor producción | Windows Server — IP 10.0.0.101 |
| Frontend servido por | Nginx/NSSM en puerto 8080 |
| Backend servido por | NSSM en puerto 3001 |

## Estructura del repositorio

```
sgpm/
├── frontend/          # React + Vite
│   └── src/
│       ├── pages/     # Vistas por rol (admin, operador, supervisor, mantenimiento)
│       ├── components/
│       ├── hooks/
│       ├── services/  # api.js — cliente Axios
│       └── utils/
├── backend/
│   └── src/
│       ├── routes/        # auth, maquinas, paros, usuarios, turnos, motivos, lineas, reportes, ia
│       ├── controllers/   # lógica de negocio
│       ├── models/        # modelos Sequelize
│       ├── middlewares/
│       └── config/
└── CLAUDE.md
```

## Roles de usuario

- **Admin** — acceso total (máquinas, usuarios, reportes, OEE, historial, turnos)
- **Supervisor** — panel de supervisión en tiempo real
- **Operador** — registra paros desde su máquina asignada
- **Mantenimiento** — panel propio para atender paros

## Funcionalidades principales

- Mapa de máquinas en tiempo real con Socket.io
- Registro de paros con motivo, duración y observaciones
- Historial y reportes exportables a PDF
- Métricas OEE por máquina/línea
- Sistema de alertas y sonidos
- Gestión de turnos

## Funcionalidades pendientes

- Agregar `kilos_por_hora` y `precio_kilo` a tabla `maquinas` (solo líneas de extrusión)
- Mostrar pérdida de producción en kilos durante paros en `MapaMaquinas`

## Flujo Git — resumen rápido

- **Nunca** hacer push directo a `main` ni `develop`
- Toda funcionalidad nueva: rama `feature/*` desde `develop`
- Todo bug no urgente: rama `fix/*` desde `develop`
- Bugs urgentes en producción: rama `hotfix/*` desde `main`, merge a `main` Y `develop`
- Ver [GIT_WORKFLOW.md](./GIT_WORKFLOW.md) para el flujo completo

## Convención de commits

```
feat:      Nueva funcionalidad
fix:       Corrección de bug
hotfix:    Corrección urgente en producción
refactor:  Cambio de código sin nueva funcionalidad
migration: Cambio en esquema de base de datos
chore:     Tareas de mantenimiento
docs:      Documentación
```

## Comandos útiles

```bash
# Backend (desde /backend)
npm run dev       # Desarrollo con nodemon
npm start         # Producción

# Frontend (desde /frontend)
npm run dev       # Desarrollo en localhost:5173
npm run build     # Build para producción (genera /dist)
```
