# Palavra do Dia - Versão Simplificada para Render

Este é um projeto simplificado do painel administrativo "Palavra do Dia", otimizado especificamente para implantação no Render.

## Sobre esta versão

Esta versão foi criada para resolver problemas de implantação no Render, utilizando uma estrutura simplificada com:

- Um único arquivo `server.js` que contém todos os modelos e rotas
- Estrutura de diretórios plana para evitar problemas de importação
- Dependências mínimas necessárias

## Funcionalidades incluídas

- Sistema de autenticação
- Gerenciamento básico de palavras (criar, listar, editar, excluir)
- Suporte para palavras em português e inglês

## Requisitos

- Node.js 14 ou superior
- MongoDB

## Configuração

1. Configure as variáveis de ambiente no arquivo `.env`:
   ```
   PORT=3000
   MONGODB_URI=sua_string_de_conexao_mongodb
   JWT_SECRET=sua_chave_secreta
   JWT_EXPIRE=30d
   NODE_ENV=production
   ```

2. Instale as dependências:
   ```
   npm install
   ```

3. Inicie o servidor:
   ```
   npm start
   ```

## Implantação no Render

1. Faça upload deste projeto para um repositório GitHub
2. No Render, crie um novo serviço Web
3. Conecte ao seu repositório GitHub
4. Configure a variável de ambiente `MONGODB_URI` com sua string de conexão MongoDB
5. Implante o serviço

## Credenciais padrão

- Email: admin@palavradodia.com
- Senha: admin123

**Importante:** Altere a senha padrão após o primeiro login.

## Próximos passos

Após confirmar que esta versão simplificada está funcionando corretamente no Render, podemos expandir gradualmente para incluir todas as funcionalidades do projeto original:

1. Sistema de geração de imagens
2. Calendário de publicação
3. Sistema de comentários
4. Estatísticas de uso
5. Interface de usuário completa
