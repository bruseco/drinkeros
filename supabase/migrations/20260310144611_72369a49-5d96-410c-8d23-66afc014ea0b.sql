
ALTER TABLE upsell_product_rules DROP CONSTRAINT upsell_product_rules_offer_product_type_check;
ALTER TABLE upsell_product_rules ADD CONSTRAINT upsell_product_rules_offer_product_type_check CHECK (offer_product_type = ANY (ARRAY['course'::text, 'package'::text, 'combo'::text]));

ALTER TABLE upsell_product_rules DROP CONSTRAINT upsell_product_rules_trigger_product_type_check;
ALTER TABLE upsell_product_rules ADD CONSTRAINT upsell_product_rules_trigger_product_type_check CHECK (trigger_product_type = ANY (ARRAY['course'::text, 'package'::text, 'combo'::text]));
