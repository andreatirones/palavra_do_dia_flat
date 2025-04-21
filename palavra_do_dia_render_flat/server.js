const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');

// Carregar variáveis de ambiente
dotenv.config();

// Inicializar app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configuração do MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log(`MongoDB conectado: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.error(`Erro ao conectar ao MongoDB: ${error.message}`);
    return false;
  }
};

// Definir modelos
const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Por favor, informe um nome'],
    trim: true,
    maxlength: [50, 'Nome não pode ter mais de 50 caracteres']
  },
  email: {
    type: String,
    required: [true, 'Por favor, informe um email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Por favor, informe um email válido'
    ]
  },
  password: {
    type: String,
    required: [true, 'Por favor, informe uma senha'],
    minlength: [6, 'Senha deve ter pelo menos 6 caracteres'],
    select: false
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Criptografar senha usando bcrypt
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Assinar JWT
UserSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
};

// Verificar senha
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', UserSchema);

const WordSchema = new mongoose.Schema({
  word: {
    pt: {
      type: String,
      required: [true, 'Palavra em português é obrigatória'],
      trim: true
    },
    en: {
      type: String,
      trim: true
    }
  },
  quote: {
    pt: {
      type: String,
      required: [true, 'Citação em português é obrigatória'],
      trim: true
    },
    en: {
      type: String,
      trim: true
    }
  },
  reference: {
    pt: {
      type: String,
      trim: true
    },
    en: {
      type: String,
      trim: true
    }
  },
  reflection: {
    pt: {
      type: String,
      required: [true, 'Reflexão em português é obrigatória'],
      trim: true
    },
    en: {
      type: String,
      trim: true
    }
  },
  publishDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'published'],
    default: 'draft'
  },
  language: {
    type: String,
    enum: ['pt', 'en'],
    default: 'pt'
  },
  images: {
    word: {
      type: String
    },
    reflection: {
      type: String
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const Word = mongoose.model('Word', WordSchema);

// Middleware de autenticação
const protect = async (req, res, next) => {
  try {
    let token;
    
    // Verificar se o token está no header Authorization
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      // Extrair token do header
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      // Ou verificar se está nos cookies
      token = req.cookies.token;
    }
    
    // Verificar se o token existe
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Acesso não autorizado. Faça login para continuar.'
      });
    }
    
    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Buscar usuário pelo ID
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não encontrado.'
      });
    }
    
    // Adicionar usuário à requisição
    req.user = user;
    
    next();
  } catch (error) {
    console.error('Erro no middleware de autenticação:', error.message);
    
    return res.status(401).json({
      success: false,
      message: 'Acesso não autorizado. Faça login para continuar.'
    });
  }
};

// Rotas de autenticação
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validar campos
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email e senha são obrigatórios'
      });
    }
    
    // Verificar se o usuário existe
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas'
      });
    }
    
    // Verificar se a senha está correta
    const isMatch = await user.matchPassword(password);
    
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas'
      });
    }
    
    // Gerar token JWT
    const token = user.getSignedJwtToken();
    
    // Remover senha do objeto de resposta
    user.password = undefined;
    
    res.status(200).json({
      success: true,
      token,
      data: user
    });
  } catch (error) {
    console.error('Erro ao fazer login:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao fazer login: ' + error.message
    });
  }
});

// Rota para obter usuário atual
app.get('/api/auth/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Erro ao obter usuário:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter usuário: ' + error.message
    });
  }
});

// Rotas para palavras
app.post('/api/words', protect, async (req, res) => {
  try {
    const { word, quote, reference, reflection, publishDate, status, language } = req.body;

    // Validar campos obrigatórios
    if (!word || !word.pt || !quote || !quote.pt || !reflection || !reflection.pt) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios faltando'
      });
    }

    // Criar nova palavra
    const newWord = new Word({
      word,
      quote,
      reference,
      reflection,
      publishDate: publishDate || new Date(),
      status: status || 'draft',
      language: language || 'pt',
      createdBy: req.user.id
    });

    // Salvar palavra
    await newWord.save();

    res.status(201).json({
      success: true,
      data: newWord
    });
  } catch (error) {
    console.error('Erro ao criar palavra:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar palavra: ' + error.message
    });
  }
});

app.get('/api/words', protect, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search, language, startDate, endDate } = req.query;
    
    // Construir filtro
    const filter = {};
    
    if (status) {
      filter.status = status;
    }
    
    if (language) {
      filter.language = language;
    }
    
    if (search) {
      filter.$or = [
        { 'word.pt': { $regex: search, $options: 'i' } },
        { 'word.en': { $regex: search, $options: 'i' } },
        { 'quote.pt': { $regex: search, $options: 'i' } },
        { 'quote.en': { $regex: search, $options: 'i' } },
        { 'reflection.pt': { $regex: search, $options: 'i' } },
        { 'reflection.en': { $regex: search, $options: 'i' } }
      ];
    }
    
    if (startDate || endDate) {
      filter.publishDate = {};
      
      if (startDate) {
        filter.publishDate.$gte = new Date(startDate);
      }
      
      if (endDate) {
        filter.publishDate.$lte = new Date(endDate);
      }
    }
    
    // Contar total de documentos
    const total = await Word.countDocuments(filter);
    
    // Buscar palavras com paginação
    const words = await Word.find(filter)
      .sort({ publishDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
    
    res.status(200).json({
      success: true,
      data: words,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total
    });
  } catch (error) {
    console.error('Erro ao buscar palavras:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar palavras: ' + error.message
    });
  }
});

app.get('/api/words/:id', protect, async (req, res) => {
  try {
    const word = await Word.findById(req.params.id);
    
    if (!word) {
      return res.status(404).json({
        success: false,
        message: 'Palavra não encontrada'
      });
    }
    
    res.status(200).json({
      success: true,
      data: word
    });
  } catch (error) {
    console.error('Erro ao buscar palavra:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar palavra: ' + error.message
    });
  }
});

app.put('/api/words/:id', protect, async (req, res) => {
  try {
    const { word, quote, reference, reflection, publishDate, status, language } = req.body;
    
    // Buscar palavra
    const existingWord = await Word.findById(req.params.id);
    
    if (!existingWord) {
      return res.status(404).json({
        success: false,
        message: 'Palavra não encontrada'
      });
    }
    
    // Atualizar campos
    if (word) existingWord.word = word;
    if (quote) existingWord.quote = quote;
    if (reference) existingWord.reference = reference;
    if (reflection) existingWord.reflection = reflection;
    if (publishDate) existingWord.publishDate = publishDate;
    if (status) existingWord.status = status;
    if (language) existingWord.language = language;
    
    // Atualizar data de modificação
    existingWord.updatedAt = Date.now();
    existingWord.updatedBy = req.user.id;
    
    // Salvar palavra
    await existingWord.save();
    
    res.status(200).json({
      success: true,
      data: existingWord
    });
  } catch (error) {
    console.error('Erro ao atualizar palavra:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar palavra: ' + error.message
    });
  }
});

app.delete('/api/words/:id', protect, async (req, res) => {
  try {
    const word = await Word.findById(req.params.id);
    
    if (!word) {
      return res.status(404).json({
        success: false,
        message: 'Palavra não encontrada'
      });
    }
    
    // Excluir palavra
    await word.remove();
    
    res.status(200).json({
      success: true,
      message: 'Palavra excluída com sucesso'
    });
  } catch (error) {
    console.error('Erro ao excluir palavra:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao excluir palavra: ' + error.message
    });
  }
});

// Rota para o frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Conectar ao MongoDB
    const dbConnected = await connectDB();
    
    if (!dbConnected) {
      console.error('Falha ao conectar ao banco de dados. Encerrando aplicação.');
      process.exit(1);
    }
    
    // Criar usuário admin padrão se não existir
    const adminExists = await User.findOne({ role: 'admin' });
    
    if (!adminExists) {
      console.log('Criando usuário administrador padrão...');
      
      // Criar hash da senha
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);
      
      // Criar usuário administrador
      const admin = new User({
        name: 'Administrador',
        email: 'admin@palavradodia.com',
        password: hashedPassword,
        role: 'admin'
      });
      
      await admin.save();
      console.log('Usuário administrador criado com sucesso!');
    }
    
    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
    });
  } catch (error) {
    console.error(`Erro ao iniciar servidor: ${error.message}`);
    process.exit(1);
  }
};

// Iniciar servidor
startServer();
