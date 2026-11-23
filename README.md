# Vigília

Rotinas católicas para o dia, em português: leituras da Missa, orações, exame de consciência,
santos, referências da Bíblia e dos Salmos, novena guiada e preparação para a confissão.
Use pela linha de comando ou pelo painel **Hoje / Biblioteca / Rotinas** no zenbot.

## CLI (Python ≥ 3.10, sem dependências de terceiros)

A gravação de notas e a leitura pelo servidor são suportadas no Linux com `/proc`.

```sh
python3 -I vigilia.py catalog
python3 -I vigilia.py angelus --date 2026-11-23 --report out/angelus.md
python3 -I vigilia.py novena --start 2026-12-01 --date 2026-12-03
python3 -I vigilia.py fetch-readings --date 2026-10-13 > /tmp/vigilia-readings.json
python3 -I vigilia.py leituras --date 2026-10-13 \
  --readings routines/readings/test/readings-2026-10-13.json \
  --notes routines/readings/test/notes-2026-10-13.json
```

A data padrão é a de São Paulo. A saída é Markdown no stdout; `--report` grava também o
arquivo que o job pode postar. Defina `VIGILIA_VAULT` como o caminho absoluto de um cofre
existente para salvar cópias em `Vigilia/AAAA-MM-DD-ID.vigilia.md`. Defina também
`VIGILIA_WEB_URL` como a URL base do zenbot (sem consulta ou fragmento) para acrescentar ao
relatório um link `?view=files&file=CAMINHO_ABSOLUTO`. O link requer acesso ao mesmo zenbot
e revela o caminho absoluto a quem receber a mensagem. Não poste relatórios privados em
salas compartilhadas sem conferir o destino.

A obtenção das leituras consulta apenas o endpoint da Edições CNBB. As leituras vêm de lá;
as notas ficam em um JSON separado, produzido por uma pessoa ou LLM. O renderizador legado
verifica que o texto da CNBB está no resultado (ignorando a formatação) e verifica a frase
selecionada. Não há fallback para outra data. Os demais comandos funcionam sem rede ou LLM.
Os scripts anteriores continuam acessíveis em `routines/`.

## Plugin zenbot e MCP App

```sh
npm ci
npm run build
npm run pack
# Instalação local, opcional:
zen plugins add ./dist/vigilia-0.1.0.tgz
```

O pacote é independente de node_modules. Use a aba Vigília ou `/vigilia [hoje|biblioteca|rotinas]`
(`!vigilia` no Matrix; a interface visual requer um host compatível). O leitor de `*.vigilia.md` usa o contexto do arquivo no host. Para que os links abram
diretamente nele, selecione **Vigília** como leitor padrão de `*.vigilia.md` nas configurações
do zenbot; sem essa seleção, o host usa o leitor embutido. **Hoje** lista as saídas de hoje no cofre;
a Biblioteca não exige nenhum job. A única permissão é `files:read` para abrir essas notas
e verificar quais saídas existem; o servidor não pede rede, IA nem gravação. Não há telemetria.
O plugin propõe agendamentos via chat; a [skill](skills/vigilia/agendar/SKILL.md) documenta
os comandos e o prompt exato para jobs comuns. Nada é agendado ou enviado automaticamente
na instalação. O checkout com Python é necessário para rodar os jobs.

## Verificação

```sh
npx playwright install chromium  # se ainda não instalado
npm run check
```

### Limites do v0

O pacote do plugin não inclui as redações importadas das orações: a biblioteca oferece
orientação original e links, e o checkout conserva os textos legados. Seleção de santos incompleta, sem precedência litúrgica; pequena seleção de referências
bíblicas, sem tradução embutida; uma novena guiada original. A interface não enumera, altera
nem desativa jobs: peça ao agente no chat. Sem autenticação, armazenamento ou serviço web
próprios. [Créditos e permissões pendentes](CREDITS.md); apenas código e material original
estão sob a licença MIT.
