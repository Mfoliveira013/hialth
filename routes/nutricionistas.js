const express = require('express');
const router = express.Router();
const { authenticateToken, isNutritionist } = require('../middleware/auth');
const supabase = require('../supabaseClient');

// Listar todos os nutricionistas
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { data: nutricionistas, error } = await supabase
      .from('nutricionistas')
      .select(`
        *,
        usuario:user_id (
          id, email, full_name, telefone
        )
      `)
      .eq('ativo', true);

    if (error) throw error;

    res.json(nutricionistas);
  } catch (error) {
    console.error('Erro ao buscar nutricionistas:', error);
    res.status(500).json({ error: 'Erro ao buscar nutricionistas' });
  }
});

// Cadastrar novo nutricionista (rota pública)
router.post('/', async (req, res) => {
  try {
    const { email, password, nome, crn, telefone, especialidade } = req.body;

    // 1. Criar usuário no Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: nome,
          telefone,
          tipo: 'nutricionista'
        }
      }
    });

    if (authError) throw authError;

    // 2. Criar perfil do nutricionista
    const { data: nutritionistData, error: profileError } = await supabase
      .from('nutricionistas')
      .insert([
        {
          user_id: authData.user.id,
          nome,
          crn,
          telefone,
          especialidade,
          ativo: false // Requer aprovação do administrador
        }
      ])
      .select();

    if (profileError) throw profileError;

    res.status(201).json({
      message: 'Cadastro realizado com sucesso! Aguarde a aprovação do administrador.',
      nutricionista: nutritionistData[0]
    });
  } catch (error) {
    console.error('Erro no cadastro de nutricionista:', error);
    res.status(400).json({ error: error.message });
  }
});

// Obter perfil do nutricionista
router.get('/me', authenticateToken, isNutritionist, async (req, res) => {
  try {
    const { data: nutricionista, error } = await supabase
      .from('nutricionistas')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    if (error) throw error;

    res.json(nutricionista);
  } catch (error) {
    console.error('Erro ao buscar perfil do nutricionista:', error);
    res.status(500).json({ error: 'Erro ao buscar perfil' });
  }
});

// Atualizar perfil do nutricionista
router.put('/me', authenticateToken, isNutritionist, async (req, res) => {
  try {
    const updates = req.body;
    
    const { data, error } = await supabase
      .from('nutricionistas')
      .update(updates)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
});

// Listar pacientes do nutricionista
router.get('/pacientes', authenticateToken, isNutritionist, async (req, res) => {
  try {
    const { data: pacientes, error } = await supabase
      .from('pacientes_nutricionistas')
      .select(`
        id,
        paciente:usuario_id (
          id, nome, email, data_nascimento, genero, objetivo, created_at
        )
      `)
      .eq('nutricionista_id', req.nutritionist.id);

    if (error) throw error;

    res.json(pacientes);
  } catch (error) {
    console.error('Erro ao buscar pacientes:', error);
    res.status(500).json({ error: 'Erro ao buscar pacientes' });
  }
});

module.exports = router;
