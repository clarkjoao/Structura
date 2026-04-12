# Lessons Learned

- Quando a deleção existe em mais de uma visualização do mesmo recurso, a confirmação precisa cobrir todos os caminhos de UI, não só o card principal.
- Estados de feedback de persistência ficam mais estáveis quando vivem em um store pequeno e separado, sem acoplar UI ao store principal do domínio.
