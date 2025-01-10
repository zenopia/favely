module.exports = {
  apps: [
    {
      name: 'curate',
      script: 'npm',
      args: 'start',
      env: {
        PORT: 3000,
        NODE_ENV: 'production'
      }
    }
  ]
} 