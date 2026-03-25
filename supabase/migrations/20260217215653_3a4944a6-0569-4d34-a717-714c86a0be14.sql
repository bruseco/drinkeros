
ALTER TABLE whatsapp_template_bindings
  DROP CONSTRAINT whatsapp_template_bindings_connection_id_process_key;

ALTER TABLE whatsapp_template_bindings
  ADD CONSTRAINT whatsapp_template_bindings_conn_process_template_key
  UNIQUE (connection_id, process, template_name);
