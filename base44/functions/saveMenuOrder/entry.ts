import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { site_menu_order } = await req.json();

    if (!site_menu_order || !Array.isArray(site_menu_order)) {
      return Response.json({ error: 'site_menu_order inválido' }, { status: 400 });
    }

    const settings = await base44.asServiceRole.entities.CompanySettings.list();
    if (!settings || settings.length === 0) {
      return Response.json({ error: 'CompanySettings não encontrado' }, { status: 404 });
    }

    const settingsId = settings[0].id;
    await base44.asServiceRole.entities.CompanySettings.update(settingsId, { site_menu_order });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});