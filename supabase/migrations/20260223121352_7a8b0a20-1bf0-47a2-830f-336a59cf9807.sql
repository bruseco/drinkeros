CREATE POLICY "Users can update own certificate cpf"
ON public.certificates FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);