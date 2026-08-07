# Cultivo diário

Rastreador de hábitos com streaks, lembretes, gráfico de progresso, ranking
com amigos e botão de apoio via Pix. Pronto pra publicar de graça.

## 1. Criar o banco de dados (Supabase, grátis)

1. Crie uma conta em https://supabase.com (dá pra entrar com GitHub).
2. Clique em **New project**, escolha um nome e uma senha (guarde a senha,
   não precisa lembrar dela depois).
3. Espere o projeto terminar de criar (1-2 minutos).
4. No menu lateral, vá em **SQL Editor** → **New query**.
5. Abra o arquivo `schema.sql` (está nesta pasta), copie todo o conteúdo,
   cole no editor e clique em **Run**.
6. Vá em **Project Settings** (ícone de engrenagem) → **API**.
   Copie dois valores:
   - **Project URL**
   - **anon public key**

## 2. Configurar o projeto localmente

1. Instale o [Node.js](https://nodejs.org) se ainda não tiver (versão 18+).
2. Nesta pasta, rode:
   ```
   npm install
   ```
3. Copie `.env.example` para um novo arquivo chamado `.env`:
   ```
   cp .env.example .env
   ```
4. Abra o `.env` e cole a URL e a chave que você copiou do Supabase.
5. Teste localmente:
   ```
   npm run dev
   ```
   Abra o link que aparecer (geralmente `http://localhost:5173`) e confira
   se tudo funciona — cria hábito, marca o dia, etc.

## 3. Colocar o Pix de verdade

Abra `src/App.jsx` e troque a linha no topo do arquivo:

```js
const PIX_KEY = "seu-email-ou-chave-pix@exemplo.com";
```

Pela sua chave Pix real (e-mail, CPF, telefone ou chave aleatória).
Se quiser usar Buy Me a Coffee em vez de/além do Pix, preencha também:

```js
const BUY_ME_A_COFFEE_URL = "https://buymeacoffee.com/seuusuario";
```

## 4. Publicar de graça (Vercel)

1. Crie uma conta em https://github.com se não tiver, crie um repositório
   novo e suba esta pasta (`git init`, `git add .`, `git commit -m "primeira versão"`,
   siga as instruções do GitHub para o `git push`).
2. Crie uma conta em https://vercel.com (dá pra entrar com GitHub).
3. Clique em **Add New → Project** e escolha o repositório que você acabou
   de subir.
4. Em **Environment Variables**, adicione as duas mesmas variáveis do seu
   `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Clique em **Deploy**. Em cerca de um minuto você recebe um link tipo
   `https://cultivo-diario.vercel.app` — é esse link que você manda pras
   pessoas.

Tudo isso (Supabase + Vercel) é gratuito nos limites de uso pessoal/pequeno.
Só passa a custar se o site crescer muito (aí é sinal bom).

## Aviso de segurança

Este projeto não tem login/senha — qualquer pessoa que acesse o site vira um
"usuário" identificado só pelo navegador dela. Isso é suficiente para um
projeto pessoal ou MVP, mas os dados não são protegidos por autenticação de
verdade. Se o projeto crescer e você quiser mais segurança (ex: impedir que
alguém apague hábitos de outra pessoa manipulando a chave pública), o próximo
passo é adicionar Supabase Auth e trocar as políticas de acesso no
`schema.sql`.
