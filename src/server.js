const app = require('./app');

// No App Service a porta vem em process.env.PORT
const porta = process.env.PORT || 3000;

app.listen(porta, () => {
  console.log(`Mural da Coordenação ouvindo na porta ${porta}`);
});