const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const supabase = require('../supabaseClient');

// Obter metas do usuário
router.get('/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Verifica se o usuário está tentando acessar suas próprias metas
    if (req.user.id !== userId) {
      return res.status(403).json({ error: 'Não autorizado' });
    }

    // Busca as metas do usuário
    const { data: metas, error } = await supabase
      .from('metas')
      .select('*')
      .eq('usuario_id', userId)
      .order('data_criacao', { ascending: false });

    if (error) throw error;

    // Se não houver metas, retorna um array vazio
    res.json(metas || []);
  } catch (error) {
    console.error('Erro ao buscar metas:', error);
    res.status(500).json({ error: 'Erro ao buscar metas' });
  }
});

// Criar nova meta
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { usuario_id, tipo, valor_alvo, data_limite, descricao } = req.body;
    
    // Verifica se o usuário está tentando criar uma meta para si mesmo
    if (req.user.id !== usuario_id) {
      return res.status(403).json({ error: 'Não autorizado' });
    }

    // Validação dos dados
    if (!tipo || !valor_alvo) {
      return res.status(400).json({ error: 'Tipo e valor alvo são obrigatórios' });
    }

    const { data: meta, error } = await supabase
      .from('metas')
      .insert([
        {
          usuario_id,
          tipo,
          valor_alvo,
          valor_atual: 0,
          data_limite: data_limite || null,
          descricao: descricao || null,
          concluida: false,
          data_criacao: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(meta);
  } catch (error) {
    console.error('Erro ao criar meta:', error);
    res.status(500).json({ error: 'Erro ao criar meta' });
  }
});

// Atualizar progresso da meta
router.put('/:id/progresso', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { valor_atual } = req.body;

    if (valor_atual === undefined) {
      return res.status(400).json({ error: 'Valor atual é obrigatório' });
    }

    // Primeiro, busca a meta para verificar se pertence ao usuário
    const { data: metaExistente, error: buscaError } = await supabase
      .from('metas')
      .select('*')
      .eq('id', id)
      .single();

    if (buscaError) throw buscaError;
    if (!metaExistente) {
      return res.status(404).json({ error: 'Meta não encontrada' });
    }
    if (metaExistente.usuario_id !== req.user.id) {
      return res.status(403).json({ error: 'Não autorizado' });
    }

    // Atualiza o progresso da meta
    const { data: metaAtualizada, error } = await supabase
      .from('metas')
      .update({
        valor_atual,
        concluida: valor_atual >= metaExistente.valor_alvo,
        data_atualizacao: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(metaAtualizada);
  } catch (error) {
    console.error('Erro ao atualizar progresso da meta:', error);
    res.status(500).json({ error: 'Erro ao atualizar meta' });
  }
});

// Excluir meta
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Primeiro, busca a meta para verificar se pertence ao usuário
    const { data: metaExistente, error: buscaError } = await supabase
      .from('metas')
      .select('usuario_id')
      .eq('id', id)
      .single();

    if (buscaError) throw buscaError;
    if (!metaExistente) {
      return res.status(404).json({ error: 'Meta não encontrada' });
    }
    if (metaExistente.usuario_id !== req.user.id) {
      return res.status(403).json({ error: 'Não autorizado' });
    }

    // Exclui a meta
    const { error } = await supabase
      .from('metas')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir meta:', error);
    res.status(500).json({ error: 'Erro ao excluir meta' });
  }
});

// Obter estatísticas de metas
router.get('/:userId/estatisticas', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Verifica se o usuário está tentando acessar suas próprias estatísticas
    if (req.user.id !== userId) {
      return res.status(403).json({ error: 'Não autorizado' });
    }

    // Busca todas as metas do usuário
    const { data: metas, error } = await supabase
      .from('metas')
      .select('*')
      .eq('usuario_id', userId);

    if (error) throw error;

    // Calcula estatísticas
    const totalMetas = metas.length;
    const metasConcluidas = metas.filter(meta => meta.concluida).length;
    const taxaConclusao = totalMetas > 0 ? (metasConcluidas / totalMetas) * 100 : 0;
    
    // Agrupa por tipo de meta
    const metasPorTipo = metas.reduce((acc, meta) => {
      if (!acc[meta.tipo]) {
        acc[meta.tipo] = {
          total: 0,
          concluidas: 0
        };
      }
      acc[meta.tipo].total++;
      if (meta.concluida) {
        acc[meta.tipo].concluidas++;
      }
      return acc;
    }, {});

    res.json({
      total_metas: totalMetas,
      metas_concluidas: metasConcluidas,
      taxa_conclusao: parseFloat(taxaConclusao.toFixed(2)),
      por_tipo: metasPorTipo
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas de metas:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

module.exports = router;
