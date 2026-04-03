-- Recreate the trigger for auto-creating profiles on new auth users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert missing profile for Duda Abreu
INSERT INTO public.profiles (user_id, email, full_name)
VALUES ('af3eae01-70c0-4f42-9b84-535492d50e16', 'eduardacbges@gmail.com', 'Duda Abreu')
ON CONFLICT DO NOTHING;