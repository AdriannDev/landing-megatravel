# Automatización de cupos: estado de implementación

El piloto usa un **Gmail dedicado con reenvío automático**, exclusivamente en simulación y desactivado por defecto. Railway lee el correo cada diez minutos. La decisión vigente es **un saldo por programa**, compartido entre todas sus fechas y orígenes. Sustituye la propuesta anterior de separar bolsas por tipo.

La guía actual describe cuenta, reenvíos, configuración de Railway, progreso IMAP, formato del extractor, revisión, conciliación y límites: [Piloto Gmail de cupos](gmail-cupos-piloto.md). [Microsoft Graph](microsoft-cupos-piloto.md) queda como alternativa desactivada. El análisis de alternativas comerciales está en [Convertalk](convertalk-viabilidad.md).

Las reservas A petición consumen sillas simuladas; confirmarlas no vuelve a descontar. Modificaciones, cancelaciones y vencimientos aplican diferencias respecto del estado previo de la reserva. Los cupos públicos siguen bajo gestión comercial y no son escritos por el piloto.

Antes de conectar el buzón, TI debe confirmar Exchange Online, limitar Application Mail.Read al buzón y verificar el rechazo en otro buzón. Faltan correos completos anonimizados para validar las plantillas reales. Antes de una futura activación pública se requiere saldo inicial con fecha de corte y siete días de simulación conciliada con Meganet. No existe una opción de activación real en esta entrega.
