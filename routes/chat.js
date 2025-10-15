const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const supabase = require('../supabaseClient');

// Obter histórico de conversas
router.get('/conversas', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Busca conversas onde o usuário é remetente ou destinatário
    const { data: conversas, error } = await supabase
      .from('mensagens_chat')
      .select('*')
      .or(`remetente_id.eq.${userId},destinatario_id.eq.${userId}`)
      .order('data_envio', { ascending: false });

    if (error) throw error;

    // Agrupa as mensagens por conversa
    const conversasAgrupadas = conversas.reduce((acc, mensagem) => {
      // Cria um ID único para a conversa (combinação ordenada dos IDs dos participantes)
      const participantes = [mensagem.remetente_id, mensagem.destinatario_id].sort();
      const conversaId = participantes.join('_');
      
      if (!acc[conversaId]) {
        acc[conversaId] = {
          id: conversaId,
          participantes: [mensagem.remetente_id, mensagem.destinatario_id],
          ultimaMensagem: mensagem,
          naoLidas: 0
        };
      }
      
      // Conta mensagens não lidas
      if (mensagem.destinatario_id === userId && !mensagem.lida) {
        acc[conversaId].naoLidas++;
      }
      
      return acc;
    }, {});

    res.json(Object.values(conversasAgrupadas));
  } catch (error) {
    console.error('Erro ao buscar conversas:', error);
    res.status(500).json({ error: 'Erro ao buscar conversas' });
  }
});

// Obter mensagens de uma conversa específica
router.get('/:userId/:nutriId', authenticateToken, async (req, res) => {
  try {
    const { userId, nutriId } = req.params;
    
    // Verifica se o usuário tem permissão para acessar esta conversa
    if (req.user.id !== userId && req.user.id !== nutriId) {
      return res.status(403).json({ error: 'Não autorizado' });
    }

    // Busca as mensagens entre os dois usuários
    const { data: mensagens, error } = await supabase
      .from('mensagens_chat')
      .select('*')
      .or(`and(remetente_id.eq.${userId},destinatario_id.eq.${nutriId}),and(remetente_id.eq.${nutriId},destinatario_id.eq.${userId})`)
      .order('data_envio', { ascending: true });

    if (error) throw error;

    // Marca mensagens como lidas
    if (mensagens.length > 0) {
      const mensagensNaoLidas = mensagens.filter(
        m => m.destinatario_id === req.user.id && !m.lida
      );
      
      if (mensagensNaoLidas.length > 0) {
        const ids = mensagensNaoLidas.map(m => m.id);
        await supabase
          .from('mensagens_chat')
          .update({ lida: true })
          .in('id', ids);
      }
    }

    res.json(mensagens);
  } catch (error) {
    console.error('Erro ao buscar mensagens:', error);
    res.status(500).json({ error: 'Erro ao buscar mensagens' });
  }
});

// Enviar mensagem
router.post('/send', authenticateToken, async (req, res) => {
  try {
    const { destinatarioId, conteudo, tipo = 'texto' } = req.body;
    const remetenteId = req.user.id;

    // Verifica se o destinatário existe
    const { data: destinatario, error: destinatarioError } = await supabase
      .from('usuarios')
      .select('id')
      .eq('id', destinatarioId)
      .single();

    if (destinatarioError || !destinatario) {
      return res.status(404).json({ error: 'Destinatário não encontrado' });
    }

    // Salva a mensagem no banco de dados
    const { data: mensagem, error } = await supabase
      .from('mensagens_chat')
      .insert([
        {
          remetente_id: remetenteId,
          destinatario_id: destinatarioId,
          conteudo,
          tipo,
          lida: false,
          data_envio: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) throw error;

    // Emite um evento WebSocket para notificar o destinatário
    req.app.get('io').to([remetenteId, destinatarioId].sort().join('_')).emit('new_message', mensagem);

    res.status(201).json(mensagem);
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
});

// Marcar mensagens como lidas
router.post('/marcar-lidas', authenticateToken, async (req, res) => {
  try {
    const { mensagensIds } = req.body;
    
    if (!Array.isArray(mensagensIds) || mensagensIds.length === 0) {
      return res.status(400).json({ error: 'IDs das mensagens são obrigatórios' });
    }

    const { error } = await supabase
      .from('mensagens_chat')
      .update({ lida: true })
      .in('id', mensagensIds)
      .eq('destinatario_id', req.user.id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao marcar mensagens como lidas:', error);
    res.status(500).json({ error: 'Erro ao atualizar mensagens' });
  }
});

module.exports = router;
