# ========================================================
# Estágio 1: Build (Compilação e Otimização do .NET 9)
# ========================================================
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# 1. Copia arquivos de projeto para otimização do cache de camadas do Docker
COPY src/EcommerceBot.Domain/EcommerceBot.Domain.csproj src/EcommerceBot.Domain/
COPY src/EcommerceBot.Application/EcommerceBot.Application.csproj src/EcommerceBot.Application/
COPY src/EcommerceBot.Infrastructure/EcommerceBot.Infrastructure.csproj src/EcommerceBot.Infrastructure/
COPY src/EcommerceBot.Api/EcommerceBot.Api.csproj src/EcommerceBot.Api/

# 2. Restaura as dependências NuGet
RUN dotnet restore src/EcommerceBot.Api/EcommerceBot.Api.csproj

# 3. Copia todo o código-fonte restante
COPY src/ src/

# 4. Publica a Web API em modo Release
WORKDIR /src/src/EcommerceBot.Api
RUN dotnet publish EcommerceBot.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

# ========================================================
# Estágio 2: Production Runtime (ASP.NET 9 Ultraleve e Seguro)
# ========================================================
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_RUNNING_IN_CONTAINER=true

# Copia os binários compilados
COPY --from=build /app/publish .

# Utiliza o usuário não-root padrão do .NET 8/9 (app)
USER app

EXPOSE 8080

ENTRYPOINT ["dotnet", "EcommerceBot.Api.dll"]
