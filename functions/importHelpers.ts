import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { action, codes, parentCodes } = await req.json();

        if (action === 'resolve_and_create') {
            const uniqueCodes = [...new Set(codes || [])];
            
            if (uniqueCodes.length === 0) return Response.json({ mapping: {} });

            // 1. Fetch Existing
            const fetchAllMap = async (entity) => {
                const map = new Map();
                let page = 0;
                while(true) {
                    const items = await base44.entities[entity].list('created_date', 1000, page * 1000);
                    if (!items || items.length === 0) break;
                    items.forEach(i => map.set(i.codigo, i));
                    if (items.length < 1000) break;
                    page++;
                }
                return map;
            };

            const [serviceMap, inputMap] = await Promise.all([
                fetchAllMap('Service'),
                fetchAllMap('Input')
            ]);

            const mapping = {};
            const servicesToCreate = [];

            // 2. Resolve
            for (const code of uniqueCodes) {
                if (inputMap.has(code)) {
                    mapping[code] = { id: inputMap.get(code).id, type: 'INSUMO', unit: inputMap.get(code).unidade };
                } else if (serviceMap.has(code)) {
                    mapping[code] = { id: serviceMap.get(code).id, type: 'SERVICO', unit: serviceMap.get(code).unidade };
                } else {
                    // Missing!
                    // User instruction: "não criar esse itens no insumos, apenas nos serviços"
                    // Assumption: All Inputs are already imported. Any unknown code is a Service.
                    
                    servicesToCreate.push({
                        codigo: code,
                        descricao: `Service ${code} (Auto)`,
                        unidade: 'UN',
                        ativo: true
                    });
                }
            }

            // 3. Create Missing Services
            const createdServices = [];
            if (servicesToCreate.length > 0) {
                 for (let i=0; i<servicesToCreate.length; i+=1000) {
                     const chunk = servicesToCreate.slice(i, i+1000);
                     const res = await base44.entities.Service.bulkCreate(chunk);
                     if (res) createdServices.push(...res);
                 }
            }

            // 4. Update Mapping
            createdServices.forEach(s => {
                mapping[s.codigo] = { id: s.id, type: 'SERVICO', unit: s.unidade };
            });

            return Response.json({ mapping });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});