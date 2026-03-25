-- Create the trigger that creates profiles when new users are created
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Insert missing profiles for users that were created without the trigger
INSERT INTO public.profiles (user_id, email, full_name)
SELECT u.id, u.email, u.raw_user_meta_data->>'full_name'
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.id IS NULL;