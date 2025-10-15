const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');

// Rota de cadastro de usuário
router.post('/signup', async (req, res) => {
  try {
    const { email, password, userData } = req.body;
    
    // Cria o usuário no Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: userData.nome,
          cpf: userData.cpf,
          data_nascimento: userData.dataNascimento,
          telefone: userData.telefone,
          tipo: 'usuario'
        }
      }
    });

    if (authError) throw authError;

    // Cria o perfil do usuário na tabela de usuários
    const { data: profileData, error: profileError } = await supabase
      .from('usuarios')
      .insert([
        {
          id: authData.user.id,
          nome: userData.nome,
          email,
          cpf: userData.cpf,
          data_nascimento: userData.dataNascimento,
          telefone: userData.telefone,
          altura: userData.altura,
          peso: userData.peso,
          genero: userData.genero,
          objetivo: userData.objetivo
        }
      ])
      .select();

    if (profileError) throw profileError;

    res.status(201).json({
      user: profileData[0],
      session: authData.session
    });
  } catch (error) {
    console.error('Erro no cadastro:', error);
    res.status(400).json({ error: error.message });
  }
});

// Rota de login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    res.json({
      user: data.user,
      session: data.session
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(401).json({ error: 'Credenciais inválidas' });
  }
});

// Rota de logout
router.post('/logout', async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    res.json({ message: 'Logout realizado com sucesso' });
  } catch (error) {
    console.error('Erro no logout:', error);
    res.status(500).json({ error: 'Erro ao fazer logout' });
  }
});

// Rota para obter o perfil do usuário autenticado
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) throw error;
    
    // Busca informações adicionais do perfil
    const { data: profile, error: profileError } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) throw profileError;

    res.json({
      ...user,
      profile
    });
  } catch (error) {
    console.error('Erro ao buscar perfil:', error);
    res.status(500).json({ error: 'Erro ao buscar perfil do usuário' });
  }
});

module.exports = router;
