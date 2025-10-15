const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const supabase = require('../supabaseClient');

// Obter perfil do usuário
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    res.json(user);
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
});

// Atualizar perfil do usuário
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Verifica se o usuário está tentando atualizar seu próprio perfil
    if (req.user.id !== id) {
      return res.status(403).json({ error: 'Não autorizado' });
    }

    const { data, error } = await supabase
      .from('usuarios')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
});

// Obter métricas de saúde do usuário
router.get('/:id/metricas', authenticateToken, async (req, res) => {
  try {
    // Verifica se o usuário está tentando acessar suas próprias métricas
    if (req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Não autorizado' });
    }

    const { data: metricas, error } = await supabase
      .from('metricas_saude')
      .select('*')
      .eq('usuario_id', req.params.id)
      .order('data_registro', { ascending: false })
      .limit(30); // Últimos 30 registros

    if (error) throw error;

    res.json(metricas);
  } catch (error) {
    console.error('Erro ao buscar métricas:', error);
    res.status(500).json({ error: 'Erro ao buscar métricas de saúde' });
  }
});

// Registrar métricas de saúde
router.post('/:id/metricas', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verifica se o usuário está tentando atualizar suas próprias métricas
    if (req.user.id !== id) {
      return res.status(403).json({ error: 'Não autorizado' });
    }

    const { data, error } = await supabase
      .from('metricas_saude')
      .insert([
        {
          usuario_id: id,
          ...req.body,
          data_registro: new Date().toISOString()
        }
      ])
      .select();

    if (error) throw error;

    res.status(201).json(data[0]);
  } catch (error) {
    console.error('Erro ao registrar métricas:', error);
    res.status(500).json({ error: 'Erro ao registrar métricas de saúde' });
  }
});

module.exports = router;
