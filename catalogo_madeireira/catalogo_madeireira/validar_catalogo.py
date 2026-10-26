"""Validação técnica do pacote. Não valida fatos comerciais nem resolve conflitos."""
from pathlib import Path
from collections import Counter
import hashlib, json, re

BASE=Path(__file__).resolve().parent

def main():
    data=json.loads((BASE/'produtos.json').read_text(encoding='utf-8'))
    products=data['produtos'];m=data['metadados']
    sources=json.loads((BASE/'inventario_fontes.json').read_text(encoding='utf-8'))
    assert len(products)==m['total_registros']==35, 'Contagem de registros'
    assert len(sources)==44, 'Contagem das imagens'
    assert len({p['id_registro'] for p in products})==35, 'IDs repetidos'
    codes=[p['codigo'] for p in products if p['codigo'] is not None]
    assert len(codes)==len(set(codes))==34, 'Códigos repetidos'
    assert all(isinstance(c,str) and re.fullmatch(r'\d{6}',c) for c in codes), 'Códigos sem zeros'
    ready=[p for p in products if p['importacao_automatica_permitida']]
    pending=[p for p in products if not p['importacao_automatica_permitida']]
    assert len(ready)==m['registros_com_concordancia_textual']==32
    assert len(pending)==m['registros_pendentes']==3
    assert {p['id_registro'] for p in pending}=={'000391','000744','pendente-tauari-15cm'}
    assert all(p['pendencias'] and p['descricao'] is None for p in pending)
    known={s['arquivo_pacote']:s for s in sources}
    assert len(known)==44
    used=set();positions=[];images=[];observed=set()
    for p in products:
        assert all(p[k] is None for k in ['preco','estoque','unidade_venda','descricao_complementar'])
        assert len(p['fontes'])==2
        individual,collage=p['fontes']
        assert individual['tipo']=='individual' and collage['tipo']=='montagem'
        assert p['imagem']==individual['arquivo']
        assert individual['arquivo'] in known and collage['arquivo'] in known
        assert p['codigos_observados']==list(dict.fromkeys(f['codigo_lido'] for f in p['fontes']))
        observed.update(p['codigos_observados'])
        images.append(p['imagem']);positions.append((collage['arquivo'],collage['posicao']))
        for f in p['fontes']:
            assert f['descricao_literal'] and re.fullmatch(r'\d{6}',f['codigo_lido'])
            used.add(f['arquivo'])
        if p['importacao_automatica_permitida']:
            assert not p['pendencias'] and p['status_revisao']=='concordancia_textual'
            assert individual['codigo_lido']==collage['codigo_lido']==p['codigo']
            assert individual['descricao_literal']==collage['descricao_literal']==p['descricao']==p['nome']
    assert len(set(images))==35
    assert len(set(positions))==35, 'Posição duplicada na montagem'
    assert Counter(f for f,pos in positions)==Counter({f'montagens/montagem-{n:02d}.png':3 if n==3 else 4 for n in range(1,10)})
    assert len(observed)==36
    assert used==set(known), 'Fonte sem vínculo ou imagem esquecida'
    for s in sources:
        f=(BASE/s['arquivo_pacote']).resolve()
        assert BASE in f.parents and f.is_file(), 'Caminho de imagem inválido'
        assert f.stat().st_size==s['bytes'], f'Tamanho alterado: {f.name}'
        assert hashlib.sha256(f.read_bytes()).hexdigest()==s['sha256'], f'Imagem alterada: {f.name}'
    assert len(list((BASE/'fotos').glob('*.png')))==35
    assert len(list((BASE/'montagens').glob('*.png')))==9
    result={'resultado':'OK','registros':35,'permitidos':32,'pendentes':3,'imagens_integras':44,'ocorrencias_transcritas':70,'codigos_distintos_observados':36,'nota':'Validação estrutural e de integridade; não certifica dados comerciais.'}
    print(json.dumps(result,ensure_ascii=False,indent=2))
    return result

if __name__=='__main__':
    main()
