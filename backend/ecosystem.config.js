module.exports = {
  apps: [
    {
      name: 'sgpm',
      script: 'src/index.js',
      cwd: 'C:\\Proyectos\\sgpm\\backend',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        DB_HOST: 'localhost',
        DB_PORT: 3306,
        DB_USER: 'root',
        DB_PASS: '',
        DB_NAME: 'sgpm',
        JWT_SECRET: 'sgpm_secret_super_seguro_2024'
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      error_file: 'C:\\Proyectos\\sgpm\\logs\\error.log',
      out_file: 'C:\\Proyectos\\sgpm\\logs\\out.log'
    }
  ]
}