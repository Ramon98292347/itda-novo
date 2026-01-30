# Documentação do Sistema ITDA (ETDA)

Este repositório contém um sistema web (SPA) para gestão escolar, com três perfis de acesso: **Secretaria**, **Professor** e **Aluno**. O frontend é feito em **React + TypeScript**, com **Vite** como bundler, UI baseada em componentes (shadcn/ui + Tailwind), e persistência/autenticação via **Supabase**.

---

## 1) Stack e execução

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS.
- **UI/UX**: shadcn/ui (Radix UI), lucide-react (ícones), sonner/toasts.
- **Dados**: Supabase (Auth + tabelas Postgres).
- **Testes**: Vitest (há um teste exemplo em `src/test`).
- **PWA**: `vite-plugin-pwa` (manifest + service worker).

Scripts principais (ver `package.json`):
- `npm run dev`: servidor local Vite.
- `npm run build`: build de produção.
- `npm run preview`: pré-visualização do build.
- `npm run lint`: eslint.
- `npm run test`: vitest.

---

## 2) Variáveis de ambiente (sem segredos no código)

O projeto depende das variáveis abaixo:

- `VITE_SUPABASE_URL`: URL do projeto Supabase.
- `VITE_SUPABASE_ANON_KEY`: chave pública (anon) do Supabase.
- `VITE_ADMIN_PASSWORD`: senha “admin” usada no cadastro pela tela de login.

Onde é usado:
- Conexão Supabase e validação de existência das variáveis: `src/lib/supabaseClient.ts`.
- Proteção do cadastro (register) no login: `src/pages/LoginPage.tsx`.

---

## 3) Estrutura de pastas (visão rápida)

- `src/main.tsx`: ponto de entrada (monta o React).
- `src/App.tsx`: providers globais + rotas (React Router).
- `src/contexts/AuthContext.tsx`: autenticação, sessão e perfil do usuário.
- `src/lib/supabaseClient.ts`: client do Supabase + helper de criação de usuário.
- `src/components/layout/*`: layout do dashboard e sidebar por perfil.
- `src/components/ui/*`: componentes UI reutilizáveis (DataTable, PageHeader, StatusBadge etc.).
- `src/pages/*`: telas por perfil (secretary/teacher/student) + login/404.
- `src/data/mockData.ts`: tipos e helpers (ex.: cálculo de média/situação).

---

## 4) Roteamento e proteção por perfil (roles)

O app usa React Router e define rotas por perfil em `src/App.tsx`:

- Público:
  - `/login`
- Secretaria:
  - `/secretary`, `/secretary/students`, `/secretary/teachers`, `/secretary/subjects`, `/secretary/classes`, `/secretary/bimesters`, `/secretary/reports`
- Professor:
  - `/teacher`, `/teacher/subjects`, `/teacher/bimesters`, `/teacher/grades`, `/teacher/attendance`
- Aluno:
  - `/student`, `/student/subjects`, `/student/grades`, `/student/absences`, `/student/status`

As páginas internas são envolvidas por `DashboardLayout`, que:
- Redireciona para `/login` quando não há sessão.
- Enforce `allowedRoles` e redireciona para o dashboard correto quando o usuário tenta entrar em uma área não permitida.

Arquivos relevantes:
- `src/App.tsx`
- `src/components/layout/DashboardLayout.tsx`
- `src/components/layout/Sidebar.tsx`

---

## 5) Autenticação e “perfil” do usuário

O login usa Supabase Auth (email/senha). Após autenticar, o sistema carrega o **perfil** do usuário na tabela `users` (Postgres) para obter `name`, `email`, `role` e `avatar_url`.

Regras importantes:
- O contexto salva um snapshot do usuário em `localStorage` (`auth:user`) para manter a sessão no reload.
- O contexto também consulta a sessão real via `supabase.auth.getSession()` para garantir consistência.
- O logout limpa estado/localStorage e chama `supabase.auth.signOut()`.

Arquivo central:
- `src/contexts/AuthContext.tsx`

---

## 6) Modelo de dados no Supabase (tabelas esperadas)

Pelo uso do código, o app espera as tabelas (e relações) abaixo:

- `users`: perfil do usuário (id = userId do Supabase Auth), `name`, `email`, `role`, `avatar_url`.
- `students`: cadastro do aluno (`user_id`, `cpf`, `birth_date`, `class_id`) + join com `users` e `classes`.
- `teachers`: cadastro do professor (`user_id`) + join com `users`.
- `subjects`: disciplinas (`name`, `workload`).
- `classes`: turmas (`name`, `academic_year`).
- `bimesters`: bimestres por disciplina (`name`, `subject_id`, `start_date`, `end_date`, `status`).
- `grades`: notas por aluno/disciplina/bimestre (`student_id`, `subject_id`, `bimester_id`, `grade1`, `grade2`, `absences`, `average`, `status`).
- `teacher_subjects`: relação N:N entre professores e disciplinas (usada para filtrar disciplinas do professor).
- `attendance`: presença por aluno/disciplina/bimestre/data (`student_id`, `subject_id`, `bimester_id`, `date`, `present`).

Observação: o app mostra mensagens direcionando para ajustes de RLS/policies quando o Supabase retorna erro de permissão.

---

## 7) Regras de cálculo de notas e situação

Existem dois helpers principais:

- `calculateAverage(grade1, grade2)`: média simples `(grade1 + grade2) / 2`.
- `calculateStatus(total)`: retorna o status de acordo com a nota final.

Status possíveis:
- `approved` (Aprovado)
- `recovery` (Recuperação)
- `failed` (Reprovado)

Regra atual (nota total arredondada para 1 casa):
- `total >= 5` → `approved`
- `total >= 3` e `< 5` → `recovery`
- `total < 3` → `failed`

Arquivo:
- `src/data/mockData.ts`

---

## 8) Funcionalidades por perfil

### 8.1) Secretaria

Objetivo: administrar cadastros e visão geral do sistema.

Telas:
- **Dashboard** (`/secretary`): métricas (alunos, professores, disciplinas, turmas, bimestres ativos) e atividades recentes (criações/lançamentos), buscando no Supabase.
  - Arquivo: `src/pages/secretary/SecretaryDashboard.tsx`
- **Alunos** (`/secretary/students`): CRUD de alunos.
  - Criação: cria usuário no Supabase Auth e depois grava `users` e `students`.
  - Edição: atualiza `users` e `students`.
  - Exclusão: remove o registro em `users` (dependendo das FKs/cascatas, pode remover aluno relacionado).
  - Arquivo: `src/pages/secretary/StudentsPage.tsx`
- **Professores** (`/secretary/teachers`): CRUD de professores + vínculo com disciplinas (`teacher_subjects`).
  - Arquivo: `src/pages/secretary/TeachersPage.tsx`
- **Disciplinas** (`/secretary/subjects`): CRUD de disciplinas.
  - Arquivo: `src/pages/secretary/SubjectsPage.tsx`
- **Turmas** (`/secretary/classes`): CRUD de turmas.
  - Arquivo: `src/pages/secretary/ClassesPage.tsx`
- **Bimestres** (`/secretary/bimesters`): CRUD de bimestres por disciplina.
  - Arquivo: `src/pages/secretary/BimestersPage.tsx`
- **Relatórios** (`/secretary/reports`): consulta notas e presença por aluno e estatísticas básicas.
  - Arquivo: `src/pages/secretary/ReportsPage.tsx`

### 8.2) Professor

Objetivo: lançar notas e presença para alunos, por disciplina e bimestre.

Telas:
- **Meu Perfil** (`/teacher`): resumo do professor e acessos.
  - Arquivo: `src/pages/teacher/TeacherDashboard.tsx`
- **Minhas Disciplinas** (`/teacher/subjects`): lista disciplinas vinculadas ao professor.
  - Arquivo: `src/pages/teacher/TeacherSubjectsPage.tsx`
- **Bimestres** (`/teacher/bimesters`): lista bimestres das disciplinas do professor.
  - Arquivo: `src/pages/teacher/TeacherBimestersPage.tsx`
- **Lançar Notas** (`/teacher/grades`):
  - Seleciona disciplina e bimestre.
  - Exibe alunos e permite inserir `grade1`, `grade2` (e calcula `average` e `status`).
  - Salva via insert/update na tabela `grades`.
  - Arquivo: `src/pages/teacher/TeacherGradesPage.tsx`
- **Lançar Presença** (`/teacher/attendance`):
  - Seleciona disciplina, bimestre e data.
  - Marca presença por aluno e salva em `attendance`.
  - Possui modal de histórico por aluno.
  - Arquivo: `src/pages/teacher/TeacherAttendancePage.tsx`

### 8.3) Aluno

Objetivo: visualizar notas, faltas e situação geral.

Telas:
- **Meu Perfil / Dashboard** (`/student`): dados do aluno, métricas (média geral, faltas) e últimas notas.
  - Arquivo: `src/pages/student/StudentDashboard.tsx`
- **Minhas Disciplinas** (`/student/subjects`): lista disciplinas disponíveis.
  - Arquivo: `src/pages/student/StudentSubjectsPage.tsx`
- **Notas por Bimestre** (`/student/grades`): lista notas e status por disciplina/bimestre.
  - Arquivo: `src/pages/student/StudentGradesPage.tsx`
- **Faltas** (`/student/absences`): lista faltas derivadas de `attendance` (present = false).
  - Arquivo: `src/pages/student/StudentAbsencesPage.tsx`
- **Situação Final** (`/student/status`): calcula média geral a partir das notas carregadas e aplica `calculateStatus`.
  - Arquivo: `src/pages/student/StudentStatusPage.tsx`

---

## 9) Componentes de UI e padrões reutilizados

- `DataTable` (`src/components/ui/DataTable.tsx`): tabela reutilizável com suporte a responsividade (colunas que escondem no mobile).
- `StatusBadge` (`src/components/ui/StatusBadge.tsx`): traduz status (`approved/recovery/failed`) e status de bimestre (`active/closed`) em badge visual.
- `PageHeader` e `StatCard`: cabeçalho e cards de métricas para dashboards.

O padrão recorrente nas páginas:
- Estado local com `useState`.
- Carregamento de dados no `useEffect`, com `cancelled` para evitar setState após unmount.
- Operações no Supabase com `try/catch` e feedback com toast.

---

## 10) PWA (instalação no celular)

O app está configurado como PWA via `vite-plugin-pwa` em `vite.config.ts`:
- Gera `manifest.webmanifest`.
- Gera `sw.js` com estratégia de precache padrão do plugin.
- Permite “Instalar” no celular (display `standalone`) quando servido em HTTPS (ou localhost).

Arquivo:
- `vite.config.ts`

---

## 11) Considerações de segurança, escalabilidade e manutenção (curto)

Do ponto de vista de segurança, a parte mais sensível é o **cadastro de usuários**: hoje ele é permitido pelo frontend usando uma `VITE_ADMIN_PASSWORD`. Isso funciona para ambientes controlados, mas para produção é mais seguro mover esse fluxo para uma **função server-side** (Edge Function) usando a **Service Role Key** fora do cliente, e deixar o frontend apenas chamar um endpoint autenticado.

Para manutenção e evolução, há uma boa base de reutilização (ex.: `DashboardLayout`, `StatusBadge`, `DataTable`). Um próximo passo prático seria centralizar mais regras (ex.: validação de formulários, normalização de dados e mapeamentos Supabase → UI) em pequenos módulos utilitários para reduzir duplicação entre páginas, além de revisar warnings de hooks (`react-hooks/exhaustive-deps`) para evitar bugs sutis em re-render/caches.

