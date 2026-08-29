# ========================================================
# Estágio 1: Build (Compilação do Runner de Migrações DbUp)
# ========================================================
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# 1. Copia o arquivo csproj e restaura dependências NuGet
COPY Database.Migrations.csproj ./
RUN dotnet restore Database.Migrations.csproj

# 2. Copia todo o código-fonte e scripts DDL embutidos
COPY . ./

# 3. Publica a aplicação CLI em modo Release
RUN dotnet publish Database.Migrations.csproj -c Release -o /app/publish /p:UseAppHost=false

# ========================================================
# Estágio 2: Production Runtime (.NET 9 Runtime Ultraleve)
# ========================================================
FROM mcr.microsoft.com/dotnet/runtime:9.0 AS runtime
WORKDIR /app

# Copia os binários compilados contendo os scripts DDL embutidos
COPY --from=build /app/publish .

# Utiliza usuário seguro não-root
USER app

ENTRYPOINT ["dotnet", "Database.Migrations.dll"]
