# Token Image Swap (simple)

Um botão na HUD do token (clique direito) abre uma lista de imagens **vinculadas ao ator**. Clicar na miniatura aplica a imagem no token.  
Clique **direito** no botão da HUD alterna para a próxima imagem da lista.  
Atalho: **Alt+I** alterna a imagem do **token selecionado**.

## Instalação manual
Coloque a pasta na sua `Data/modules/token-image-swap` e ative o módulo no mundo.

## Como usar
1. Clique com o direito no token → botão de **galeria** na coluna esquerda.
2. **Adicionar** para cadastrar imagens via FilePicker.
3. Clique em **Usar** numa miniatura para aplicar na hora.
4. Opções no topo:  
   - **Atualizar retrato da ficha**: também muda `actor.img`.  
   - **Salvar no prototype**: altera `actor.prototypeToken.texture.src` (pode exigir permissão de GM).

## Configurações
- **Atualizar retrato da ficha por padrão**  
- **Salvar no prototype por padrão**  
Definidas em *Configurações do Mundo* → *Módulos*.

## Permissões
Jogadores precisam poder **atualizar o próprio token** para aplicar a imagem.  
Salvar no prototype normalmente exige permissão de **GM**.

## Compatibilidade
Testado em Foundry VTT v10–v12.

Licença: MIT
