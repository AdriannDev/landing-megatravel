# Convertalk: evaluación de integración

Esta entrega no modifica Convertalk, WhatsApp ni Google Sheets. PostgreSQL continúa como fuente comercial del CMS.

`GET /api/public/catalog` expone programas publicados y vigentes, código, fechas, origen, precios, moneda, duración, enlaces y disponibilidad vigente. No concede acceso directo a PostgreSQL ni devuelve pasajeros. El bot debe respetar la ausencia de cupos cuando su revisión caduca. Los enlaces al descriptivo no equivalen a disponer del itinerario diario completo.

| Alternativa | Comprobación pendiente |
| --- | --- |
| Entrenar con JSON público | Convertalk documenta Website → Scan JSON information. Probar interpretación, actualización y retirada de productos. Entrenar no garantiza datos actuales en cada respuesta. |
| Consultar la API durante la conversación | Preferible para precios y cupos actuales. Confirmar que el plan y flujo de la cuenta permiten HTTP externo; la documentación pública de APIs externas no acredita esa capacidad. |
| Mantener Sheets como copia | Sincronización unidireccional desde PostgreSQL. Verificar cómo lee la hoja el bot: el conector de entrenamiento requiere resincronizar después de cambios. Actualizar el Sheet no acredita actualizar su conocimiento. |

Recomendación: probar JSON para catálogo y verificar consultas HTTP durante la conversación. Si no se permiten consultas actuales, las respuestas de disponibilidad deben remitir a comprobación comercial actualizada.

Referencias: [sitios web y JSON](https://help.convertalk.com/train-your-ai-chatbot/website), [APIs externas](https://help.convertalk.com/developer/3_party_app_api), [entrenamiento con Sheets](https://help.convertalk.com/train-your-ai-chatbot/google_sheets).

Microsoft es la primera opción del piloto. Gmail personal requeriría reenvío autorizado por TI, proyecto Google Cloud con Gmail API, cliente OAuth, consentimiento inicial y almacenamiento privado del token de renovación. `gmail.readonly` es restringido; una aplicación externa en Testing puede recibir tokens que caducan a los siete días. El reenvío externo también puede estar bloqueado por la organización. Revisar [scopes de Gmail](https://developers.google.com/workspace/gmail/api/auth/scopes), [caducidad OAuth](https://developers.google.com/identity/protocols/oauth2#expiration) y [políticas de reenvío de Microsoft](https://learn.microsoft.com/en-us/defender-office-365/outbound-spam-policies-external-email-forwarding) antes de elegir esta alternativa.
