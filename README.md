# Loop

Projeto acadêmico de aluguel de vagas particulares. Motoristas buscam vagas próximas a um destino no Google Maps e reservam um período; proprietários anunciam vagas; administradores consultam usuários, vagas e reservas. Não há pagamentos nem autenticação real.

## Tecnologias

- API REST: C# / ASP.NET Core 8 com Minimal APIs, Entity Framework Core, PostgreSQL e Swagger.
- Interface: React, HTML, CSS e `fetch()` para consumir a API.
- Mapa e busca por endereço: Google Maps JavaScript API e Geocoding API.
- Banco local: PostgreSQL 16 pelo Docker Compose ou por instalação própria.

O projeto usa EF Core como camada de acesso ao PostgreSQL. Prisma não é necessário para o back-end em C#.

## Pré-requisitos

- .NET SDK 8 ou superior (`dotnet --version`)
- Node.js 18 ou superior e npm
- Docker Desktop com Docker Compose, **ou** PostgreSQL instalado e em execução
- Chave da plataforma Google Maps para mapa e geocodificação

## Como executar

1. Na raiz do projeto, ligue o banco com `docker compose up -d`. Se usar PostgreSQL próprio, crie um banco chamado `loop` e ajuste a conexão conforme o passo 2.
2. Em outro terminal, execute `dotnet run --project backend/Loop.Api --launch-profile http`. A API ficará em `http://localhost:5080` e o Swagger em `http://localhost:5080/swagger`.
3. A conexão padrão de desenvolvimento está em `backend/Loop.Api/appsettings.json` e usa `postgres/postgres` na porta local **5433**. O PostgreSQL dentro do contêiner continua na porta 5432. Para outra conexão, configure a variável de ambiente `ConnectionStrings__Default` antes de iniciar a API.
4. Copie `frontend/.env.example` para `frontend/.env.local` e substitua `COLE_SUA_CHAVE_AQUI` pela chave do Google Maps.
5. Em outro terminal, execute `cd frontend`, `npm install` e `npm run dev`. Abra `http://127.0.0.1:5173`.

No Windows PowerShell, uma conexão personalizada para **esse terminal** pode ser definida assim:

```powershell
$env:ConnectionStrings__Default = 'Host=localhost;Port=5433;Database=loop;Username=postgres;Password=SUA_SENHA'
dotnet run --project backend/Loop.Api --launch-profile http
```

O banco e três perfis de demonstração são criados na primeira inicialização: Marina (motorista), Lucas (proprietário) e Equipe Loop (administrador). Também são cadastradas três vagas de exemplo em Florianópolis. Os perfis são apenas uma simulação para demonstrar os fluxos; qualquer pessoa com acesso à API pode informar um ID de usuário. Não use este projeto como sistema público de reservas sem autenticação e autorização reais.

## Chave do Google Maps

No [Google Cloud Console](https://console.cloud.google.com/), crie ou selecione um projeto, configure faturamento e habilite **Maps JavaScript API** e **Geocoding API**. Em **APIs e serviços → Credenciais**, crie uma chave de API. Nas restrições da chave, selecione **Sites** (referenciadores HTTP) e inclua `http://127.0.0.1:5173/*` e `http://localhost:5173/*`. Nas restrições de API, permita somente as duas APIs usadas. Configure alertas/cotas no projeto para controlar custos.

A chave de navegador aparece nas requisições do navegador por definição; a proteção vem das restrições de referenciador e de API. O arquivo `.env.local` não é versionado. Sem chave, a interface mostra um aviso no lugar do mapa e o cadastro de vaga exige a configuração para selecionar a localização.

## Regras principais

- O proprietário escolhe cobrança por hora, por diária ou valor fixo. Hora e diária iniciadas são arredondadas para cima. Não existe pagamento no sistema.
- A disponibilidade pode ser semanal (dias escolhidos) ou de uma data específica. O horário 23:59 é tratado como fim do dia para permitir reservas que atravessem a meia-noite. A interface usa o horário de Brasília.
- A API só confirma reservas futuras dentro da disponibilidade e sem sobreposição com outra reserva confirmada. A verificação ocorre em transação serializável do PostgreSQL, para lidar também com tentativas simultâneas.
- O motorista pode cancelar antes do início. Uma vaga com reserva futura confirmada não pode ser alterada ou desativada.
- O administrador apenas lista os dados. A exclusão de vaga é uma desativação, preservando o histórico.

## Principais rotas da API

| Método | Rota | Função |
| --- | --- | --- |
| GET / POST | `/api/users` | Listar e cadastrar usuários |
| GET / POST | `/api/spots` | Listar e cadastrar vagas |
| GET / PUT / DELETE | `/api/spots/{id}` | Detalhes, alteração e desativação |
| GET / POST | `/api/bookings` | Listar e reservar |
| DELETE | `/api/bookings/{id}?driverId=...` | Cancelar reserva |

O Swagger mostra os formatos completos de entrada e saída. A criação inicial do esquema usa `EnsureCreated`, adequada para a demonstração. Se o modelo do banco mudar depois que o volume já foi criado, será necessário aplicar migrações do EF Core ou recriar o banco de desenvolvimento conscientemente.

## Autores

Gustavo Henrique Fidriszwski de Melo; Poliana Camponogara Lorenzoni; Laura Eduarda Kaizer Botelho; Murilio Porfirio Dias; Isabela Quintilhano Benthin.
