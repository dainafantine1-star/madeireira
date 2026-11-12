-- Os triggers de imutabilidade do SQLite não foram migrados. Sem eles,
-- a auditoria e o histórico de pedidos podiam ser editados ou apagados, o que
-- anula a garantia de que registram o que aconteceu.
CREATE OR REPLACE FUNCTION loja.sem_alteracao() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is immutable', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_no_update ON loja.audit_log;
CREATE TRIGGER audit_no_update BEFORE UPDATE ON loja.audit_log
  FOR EACH ROW EXECUTE FUNCTION loja.sem_alteracao();

DROP TRIGGER IF EXISTS audit_no_delete ON loja.audit_log;
CREATE TRIGGER audit_no_delete BEFORE DELETE ON loja.audit_log
  FOR EACH ROW EXECUTE FUNCTION loja.sem_alteracao();

DROP TRIGGER IF EXISTS order_history_no_update ON loja.order_history;
CREATE TRIGGER order_history_no_update BEFORE UPDATE ON loja.order_history
  FOR EACH ROW EXECUTE FUNCTION loja.sem_alteracao();

DROP TRIGGER IF EXISTS order_history_no_delete ON loja.order_history;
CREATE TRIGGER order_history_no_delete BEFORE DELETE ON loja.order_history
  FOR EACH ROW EXECUTE FUNCTION loja.sem_alteracao();
