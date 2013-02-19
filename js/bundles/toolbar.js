// Author: Rok Garbas
// Contact: rok@garbas.si
// Version: 1.0
//
// Description:
//    plone.toolbar.js script makes sure that all dropdowns in Plone's toolbar
//    are in sync with iframe's stretching/schrinking.
// 
// License:
//
// Copyright (C) 2010 Plone Foundation
//
// This program is free software; you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation; either version 2 of the License.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along with
// this program; if not, write to the Free Software Foundation, Inc., 51
// Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
//

/*jshint bitwise:true, curly:true, eqeqeq:true, immed:true, latedef:true,
  newcap:true, noarg:true, noempty:true, nonew:true, plusplus:true,
  undef:true, strict:true, trailing:true, browser:true, evil:true */
/*global define:false */


define([
  'jquery',
  'js/jquery.iframe',
  'jam/Patterns/src/registry',
  'js/patterns/backdrop',
  'jam/jquery-form/jquery.form.js',
  'js/patterns/toggle',
  'js/patterns/modal.js',
  'js/bundles/widgets'
], function($, iframe, registry, Backdrop) {
  "use strict";

  window.plone = window.plone || {};
  window.plone.toolbar = window.plone.toolbar || {};

  $(document).ready(function() {

    // Dropdown {{{

    // toggle class on click (shows dropdown)
    $('.toolbar-dropdown > a').toggle({
      target: '.toolbar-dropdown',
      value: 'toolbar-dropdown-open'
    });

    // at opening toolbar dropdown:
    // - close all other opened dropdown buttons
    // - stretch iframe
    // at closing dropdown shrink iframe
    $(document)
      .on('add-attr.toggle.patterns', '.toolbar-dropdown > a', function(e) {
        var $el = $(this);
        $('.toolbar-dropdown-open > a').each(function() {
          if ($el[0] !== $(this)[0]) {
            $(this).trigger('click');
          }
        });
        iframe.stretch();
      })
      .on('removed-attr.toggle.patterns', '.toolbar-dropdown > a', function(e) {
        iframe.shrink();
      });

    // }}}

    // Modals {{{

    // make sure we close all dropdowns when iframe is shrinking
    iframe.$el.on('shrink.iframe', function(e) {
      $('.toolbar-dropdown-open > a').each(function() {
        $(this).trigger('click');
      });
    });

    // integration of toolbar and modals
    $(document)
      .on('before-ajax.modal.patterns', 'a.modal-trigger', function(e) {
        var $el = $(this);
        $('.toolbar-dropdown-open > a').each(function() {
          if ($el[0] !== $(this)[0]) {
            $(this).trigger('click');
          }
        });
        $('body', iframe.document).css('overflow', 'hidden');
        iframe.stretch();
      })
      .on('show.modal.patterns', 'a.modal-trigger', function(e, modal) {
        var $el = $(this);
        $('.toolbar-dropdown-open > a').each(function() {
          if ($el[0] !== $(this)[0]) {
            $(this).trigger('click');
          }
        });
        $('body', iframe.document).css('overflow', 'hidden');
        iframe.stretch();
      })
      .on('hidden.modal.patterns', 'a.modal-trigger', function(e) {
        $('body', iframe.document).css('overflow', 'visible');
        iframe.shrink();
      });

    // modal template for plone
    function modalTemplate($modal, options) {
      var $content = $modal.html();

      options = $.extend({
        title: 'h1.documentFirstHeading',
        buttons: '.formControls > input[type="submit"]',
        content: '#content'
      }, options || {});

      $modal
        .html('<div class="modal-header">' +
              '  <a class="close">&times;</a>' +
              '  <h3></h3>' +
              '</div>' +
              '<div class="modal-body"></div>' +
              '<div class="modal-footer"></div>');


      $('.modal-header > h3', $modal).html($(options.title, $content).html());
      $('.modal-body', $modal).html($(options.content, $content).html());
      $(options.title, $modal).remove();
      $('.modal-header > a.close', $modal)
        .off('click')
        .on('click', function(e) {
          e.stopPropagation();
          e.preventDefault();
          $(e.target).trigger('destroy.modal.patterns');
        });

      // cleanup html
      $('.row', $modal).removeClass('row');

      $(options.buttons, $modal).each(function() {
        var $button = $(this);
        $button
          .on('click', function(e) {
            e.stopPropagation();
            e.preventDefault();
          })
          .clone()
          .appendTo($('.modal-footer', $modal))
          .off('click').on('click', function(e) {
            e.stopPropagation();
            e.preventDefault();
            $button.trigger('click');
          });
        $button.hide();
      });

    }

    function modalAjaxForm(modal, modalInit, options) {
      options = $.extend({
        buttons: {},
        timeout: 5000,
        formError: '.portalMessage.error'
      }, options);

      $.each(options.buttons, function(button, buttonOptions) {
        var $button = $(button, modal.$modal);

        buttonOptions = $.extend({}, options, buttonOptions);

        // pass button that was clicked when submiting form
        var extraData = {};
        extraData[$button.attr('name')] = $button.attr('value');

        $button.on('click', function(e) {
          e.stopPropagation();
          e.preventDefault();

          // loading "spinner"
          var backdrop = modal.$modal.data('patterns-backdrop');
          if (!backdrop) {
            backdrop = new Backdrop(modal.$modal, {
              closeOnEsc: false,
              closeOnClick: false
            });
            backdrop.$backdrop
              .html('')
              .append($('' +
                  '<div class="progress progress-striped active">' +
                  '  <div class="bar" style="width: 100%;"></div>' +
                  '</div>')
                .css({
                  position: 'absolute',
                  left: modal.$modal.width() * 0.1,
                  top: modal.$modal.height()/2 + 10,
                  width: modal.$modal.width() * 0.8
                }));
            modal.$modal.data('patterns-backdrop', backdrop);
          } else {
            modal.$modal.append(backdrop.$backdrop);
          }
          backdrop.show();

          $button.parents('form').ajaxSubmit({
            timeout: buttonOptions.timeout,
            dataType: 'html',
            data: extraData,
            url: $button.parents('form').attr('action'),
            error: function(xhr, textStatus, errorStatus) {
              if (textStatus === 'timeout' && buttonOptions.onTimeout) {
                buttonOptions.onTimeout(modal, xhr, errorStatus);

              // on "error", "abort", and "parsererror"
              } else if (buttonOptions.onError) {
                buttonOptions.onError(xhr, textStatus, errorStatus);
              } else {
                console.log('error happened do something');
              }
            },
            success: function(response, state, xhr, form) {
              var responseBody = $((/<body[^>]*>((.|[\n\r])*)<\/body>/im).exec(response)[0]
                      .replace('<body', '<div').replace('</body>', '</div>'));

              // if error is found
              if ($(buttonOptions.formError, responseBody).size() !== 0) {
                if (buttonOptions.onFormError) {
                  buttonOptions.onFormError(modal, responseBody, state, xhr, form);
                } else {
                  modal.$modal.html(responseBody.html());
                  modalInit(modal, modalInit);
                  registry.scan(modal.$modal);
                }

              // custom success function
              } else if (buttonOptions.onSuccess) {
                buttonOptions.onSuccess(modal, responseBody, state, xhr, form);

              } else {
                $button.trigger('destroy.modal.patterns');
              }
            }
          });
        });
      });
    }

    function modalInit(id, callback) {
      $('#' + id + ' > a').addClass('modal-trigger').modal();
      $(document).on('show.modal.patterns', '#' + id +
            ' > a.modal-trigger', function(e, modal) {
        callback(modal, callback);
      });
    }

    // }}}

    // TODO: Contents

    // Edit
    modalInit('plone-action-edit', function(modal, modalInit) {
      modalTemplate(modal.$modal, {
        buttons: 'input[name="form.buttons.save"],input[name="form.buttons.cancel"]'
      });
      $('span.label', modal.$modal).removeClass('label');
      modalAjaxForm(modal, modalInit, {
        buttons: {
          '.modal-body input[name="form.buttons.cancel"]': {},
          '.modal-body input[name="form.buttons.save"]': {
            onSuccess: function(modal, responseBody, state, xhr, form) {
              $('#portal-column-content', window.parent.document).html(
                  $('#portal-column-content', responseBody).html());
              modal.hide();
            }
          }
        }
      });
    });


    // Sharing
    modalInit('plone-action-local_roles', function(modal, modalInit) {
      modalTemplate(modal.$modal, {
        buttons: 'input[name="form.button.Save"],input[name="form.button.Cancel"]'
      });
      // FIXME: we shouldn't be hacking like this
      $('#link-presentation', modal.$modal).remove();
      modalAjaxForm(modal, modalInit, {
        buttons: {
          '.modal-body input[name="form.button.Cancel"]': {},
          '.modal-body input[name="form.button.Save"]': {},
          '.modal-body input[name="form.button.Search"]': {
            onSuccess: function(modal, responseBody, state, xhr, form) {
              modal.$modal.html(responseBody.html());
              modalInit(modal, modalInit);
              modal.positionModal();
              registry.scan(modal.$modal);
            }
          }
        }
      });

    });

    // Rules form
    // TODO: for now we only open overlay we need to test that forms are
    //       working
    modalInit('plone-action-contentrules', function(modal, modalInit) {
      modalTemplate(modal.$modal);
      modalAjaxForm(modal, modalInit);
    });

    // Delete Action
    modalInit('plone-contentmenu-actions-delete', function(modal, modalInit) {
      modalTemplate(modal.$modal, {
        buttons: 'input[name="form.button.Cancel"],input.destructive'
      });
      modalAjaxForm(modal, modalInit, {
        buttons: {
          '.modal-body input[name="form.button.Cancel"]': {},
          '.modal-body input.destructive': {
            onSuccess: function(modal, responseBody, state, xhr, form) {
              window.parent.location.href = window.parent.location.href + '/..';
            }
          }
        }
      });
    });

    // Rename Action
    modalInit('plone-contentmenu-actions-rename', function(modal, modalInit) {
      modalTemplate(modal.$modal, {
        buttons: 'input[name="form.button.Cancel"],input[name="form.button.RenameAll"]'
      });
      modalAjaxForm(modal, modalInit, {
        buttons: {
          '.modal-body input[name="form.button.Cancel"]': {},
          '.modal-body input[name="form.button.RenameAll"]': {
            onSuccess: function(modal, responseBody, state, xhr, form) {
              window.parent.location.href = responseBody.data('context-url') || window.parent.location.href;
            }
          }
        }
      });
    });

    // Change content item as default view...
    var changeContentItemAsDefaultView = function(modal, modalInit) {
      modalTemplate(modal.$modal);
      // FIXME: we should hack like this
      $('form > dl', modal.$modal).addClass('default-page-listing');
      $('input[name="form.button.Cancel"]', modal.$modal).attr('class', 'standalone');
      modalAjaxForm(modal, modalInit, {
        buttons: {
          '.modal-body input[name="form.button.Cancel"]': {},
          '.modal-body input[name="form.button.Save"]': {
            onSuccess: function(modal, responseBody, state, xhr) {
              window.parent.location.href = window.parent.location.href;
            }
          }
        }
      });
    };
    modalInit('folderChangeDefaultPage', changeContentItemAsDefaultView);
    modalInit('contextSetDefaultPage', changeContentItemAsDefaultView);

    // TODO: Add forms

    // "Restrictions..." form
    modalInit('plone-contentmenu-settings', function(modal, modalInit) {
      modalTemplate(modal.$modal);
      // FIXME: we should hack like this
      var $details = $('#details', modal.$modal)
        .removeAttr('style')
        .removeAttr('id')
        .first().parent();

      function show_submenu($modal) {
        if ($('#mode_enable', $modal).is(':checked')) {
          $details.attr({'id': 'details', 'style': ''});
        } else {
          $details.attr({'id': 'details', 'style': 'display:none;'});
        }
      }
      function check_mode($modal, value) {
        // The logic here is that from #6151, comment 12.
        var $preferred = $('#' + value, $modal),
            $allowed = $('#' + value + '_allowed', $modal),
            $allowed_hidden = $('#' + value + '_allowed_hidden', $modal);

        // type is not preferred, so it is not allowed, too.
        // We uncheck and disable (ghost) the allowed checkbox
        if (!$preferred.is(':checked')) {
          $allowed.attr('checked', false);
          $allowed.attr('disabled', true);

        // type _is_ preferred, so user _may_ want to make it
        // an "allowed-only" type by checking the "allowed" checkbox.
        // We need to enable (unghost) the allowed checkbox
        } else {
          $allowed.attr('disabled', false);
        }
      }

      $('input[name="constrainTypesMode:int"]', modal.$modal)
        .removeAttr('onclick')
        .on('click', function() {
          show_submenu($(this).parents('.modal'));
        });
      $('input[name="currentPrefer:list"],input[name="currentAllow:list"]', modal.$modal)
        .removeAttr('onclick')
        .on('click', function() {
          check_mode($(this).parents('.modal'), $(this).attr('id'));
        });
      show_submenu(modal.$modal);

      modalAjaxForm(modal, modalInit, {
        buttons: {
          '.modal-body input[name="form.button.Cancel"]': {},
          '.modal-body input[name="form.button.Save"]': {
            onSuccess: function(modal, responseBody, state, xhr) {
              $('#plone-contentmenu-factories').html(
                  $('#plone-contentmenu-factories', responseBody).html());
              modal.hide();
            }
          }
        }
      });
    });

    // Advance workflow
    modalInit('workflow-transition-advanced', function(modal, modalInit) {
      modalTemplate(modal.$modal, {
        buttons: 'input[name="form.button.Cancel"],input[name="form.button.FolderPublish"],input[name="form.button.Publish"]'
      });

      // FIXME: we should _not_ hack like this
      $('#workflow_action', modal.$modal).parent().find('> br').remove();

      modalAjaxForm(modal, modalInit, {
        buttons: {
          '.modal-body input[name="form.button.Cancel"]': {},
          '.modal-body input[name="form.button.Publish"], .modal-body input[name="form.button.FolderPublish"]': {
            onSuccess: function(modal, responseBody, state, xhr) {
              $('#plone-contentmenu-workflow')
                .html($('#plone-contentmenu-workflow', responseBody).html());
              $('#plone-contentmenu-workflow > a').toggle({
                target: '.toolbar-dropdown',
                value: 'toolbar-dropdown-open'
              });
              $('#plone-contentmenu-workflow #workflow-transition-advanced > a')
                  .addClass('modal-trigger').modal();
              $('body', iframe.document).css('overflow', 'visible');
              modal.hide();
            }
          }
        }
      });
    });

  });

});