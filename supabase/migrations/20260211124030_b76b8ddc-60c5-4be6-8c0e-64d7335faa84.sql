-- Allow users to insert their own profile (needed for OAuth/Magic Link auto-creation)
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);
