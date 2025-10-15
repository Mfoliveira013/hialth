const jwt = require('jsonwebtoken');
const supabase = require('../supabaseClient');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido' });
  }

  try {
    // Verifica se o token é válido com o Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) throw error;
    
    // Adiciona o usuário à requisição para uso posterior
    req.user = user;
    next();
  } catch (error) {
    console.error('Erro na autenticação:', error);
    return res.status(403).json({ error: 'Token inválido ou expirado' });
  }
};

// Middleware para verificar se o usuário é um nutricionista
const isNutritionist = async (req, res, next) => {
  try {
    const { data: nutritionist, error } = await supabase
      .from('nutricionistas')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    if (error || !nutritionist) {
      return res.status(403).json({ error: 'Acesso negado: usuário não é um nutricionista' });
    }

    req.nutritionist = nutritionist;
    next();
  } catch (error) {
    console.error('Erro ao verificar permissões de nutricionista:', error);
    return res.status(500).json({ error: 'Erro ao verificar permissões' });
  }
};

module.exports = {
  authenticateToken,
  isNutritionist
};
