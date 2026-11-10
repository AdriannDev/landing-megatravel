# Automatización de cupos: estado de implementación

El lector de Gmail está desactivado por defecto y usa simulación al habilitarlo. Railway lee el correo cada diez minutos. El modo real toma el saldo registrado en **Programas**, compartido entre todas sus fechas y orígenes.

La guía actual describe cuenta, reenvíos, configuración de Railway, progreso IMAP, formato del extractor, revisión, conciliación y límites: [Piloto Gmail de cupos](gmail-cupos-piloto.md). [Microsoft Graph](microsoft-cupos-piloto.md) queda como alternativa desactivada. El análisis de alternativas comerciales está en [Convertalk](convertalk-viabilidad.md).

Las reservas A petición consumen sillas. Su confirmación conserva el saldo. Las modificaciones, cancelaciones y vencimientos aplican diferencias respecto del estado previo de la reserva. En modo real, cada cambio de cupos queda registrado en el historial del programa.

La prueba de cupos reales puede limitarse a un MTPE y aplica avisos posteriores a la fecha de inicio configurada. Falta validar las plantillas de Meganet con correos completos anonimizados antes de usarlas para aplicar movimientos.
