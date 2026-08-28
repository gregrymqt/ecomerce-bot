**[ALERTA WORKER - {{ environment|upper }}]**
📌 **Evento:** {{ event_name }}
🏢 **Tenant:** {{ tenant_id }}
⏱️ **Timestamp:** {{ timestamp }}
{% if error_message %}
❌ **Erro:**
```
{{ error_message }}
```
{% endif %}
