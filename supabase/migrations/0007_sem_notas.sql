-- Tira as observações longas (nota / obs) das carteiras já salvas.
update public.wallet_carteiras
set dados = jsonb_set(
      jsonb_set(dados, '{config,receber}',
        coalesce((select jsonb_agg(x - 'nota') from jsonb_array_elements(dados #> '{config,receber}') x), '[]'::jsonb)),
      '{config,compartilhadas}',
      coalesce((select jsonb_agg(x - 'obs') from jsonb_array_elements(dados #> '{config,compartilhadas}') x), '[]'::jsonb))
    || jsonb_build_object('updatedAt', (extract(epoch from now()) * 1000)::bigint + 300000),
    updated_at = now()
where dados #> '{config,receber}' is not null and dados #> '{config,compartilhadas}' is not null;
